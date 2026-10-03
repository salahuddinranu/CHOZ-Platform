// ============================================================
// CHOZ API — Cloudflare Pages Functions
// Handles all /api/* requests server-side
// ============================================================

export async function onRequest(context) {
    const { request, env, params } = context;
    const url = new URL(request.url);
    const path = url.pathname.replace('/api/', '');

    // CORS headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // Route: /api/comparison/start
        if (path === 'comparison/start' && request.method === 'POST') {
            const body = await request.json();
            return await startComparison(body, env, corsHeaders);
        }

        // Route: /api/comparison/reveal
        if (path === 'comparison/reveal' && request.method === 'POST') {
            const body = await request.json();
            return await revealComparison(body, env, corsHeaders);
        }

        // Route: /api/email/send
        if (path === 'email/send' && request.method === 'POST') {
            const body = await request.json();
            return await sendEmail(body, env, corsHeaders);
        }

        // Route: /api/analytics/track
        if (path === 'analytics/track' && request.method === 'POST') {
            const body = await request.json();
            return await trackEvent(body, env, corsHeaders);
        }

        // Route: /api/health
        if (path === 'health') {
            return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify({ error: 'Not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

// ============================================================
// COMPARISON ENGINE
// ============================================================

async function startComparison(body, env, headers) {
    const { category_id, user_id } = body;
    const supabaseUrl = env.SUPABASE_URL;
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

    // Fetch items server-side
    const res = await fetch(`${supabaseUrl}/rest/v1/items?category_id=eq.${category_id}&is_active=eq.true&limit=6`, {
        headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`
        }
    });
    const items = await res.json();

    if (!items || items.length < 2) {
        return new Response(JSON.stringify({ error: 'Not enough items' }), {
            status: 400, headers: { ...headers, 'Content-Type': 'application/json' }
        });
    }

    // Server-side blind mapping (secure — client never sees this)
    const labels = ['A', 'B', 'C'];
    const shuffled = items.sort(() => Math.random() - 0.5).slice(0, 3);
    const mapping = {};
    shuffled.forEach((item, i) => {
        mapping[labels[i]] = {
            id: item.id,
            name: item.name,
            brand_id: item.brand_id,
            attributes: item.metadata || {}
        };
    });

    // Create session in database
    const sessionToken = crypto.randomUUID();
    const sessionRes = await fetch(`${supabaseUrl}/rest/v1/comparison_sessions`, {
        method: 'POST',
        headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({
            user_id,
            session_token: sessionToken,
            option_mapping: mapping,
            is_revealed: false,
            expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        })
    });
    const session = await sessionRes.json();

    // Return ONLY the blind options (no brand names!)
    const blindOptions = labels.map(label => ({
        label,
        attributes: mapping[label].attributes,
        // NO name, NO brand_id exposed here
    }));

    return new Response(JSON.stringify({
        session_token: sessionToken,
        options: blindOptions,
        category_id
    }), {
        headers: { ...headers, 'Content-Type': 'application/json' }
    });
}

async function revealComparison(body, env, headers) {
    const { session_token, chosen_label } = body;
    const supabaseUrl = env.SUPABASE_URL;
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

    // Fetch session
    const res = await fetch(`${supabaseUrl}/rest/v1/comparison_sessions?session_token=eq.${session_token}`, {
        headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
    });
    const sessions = await res.json();
    if (!sessions.length) {
        return new Response(JSON.stringify({ error: 'Session not found' }), {
            status: 404, headers: { ...headers, 'Content-Type': 'application/json' }
        });
    }
    const session = sessions[0];

    // Get the actual item ID from server-side mapping
    const itemInfo = session.option_mapping[chosen_label];
    if (!itemInfo) {
        return new Response(JSON.stringify({ error: 'Invalid choice' }), {
            status: 400, headers: { ...headers, 'Content-Type': 'application/json' }
        });
    }

    // Fetch full item details
    const itemRes = await fetch(`${supabaseUrl}/rest/v1/items?id=eq.${itemInfo.id}&select=*,brands(*),item_attributes(*,attribute_definitions(*))`, {
        headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
    });
    const items = await itemRes.json();
    const item = items[0];

    // Record choice
    await fetch(`${supabaseUrl}/rest/v1/comparison_choices`, {
        method: 'POST',
        headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            session_id: session.id,
            chosen_option_label: chosen_label,
            revealed_item_id: item.id,
            is_locked: true
        })
    });

    // Mark revealed
    await fetch(`${supabaseUrl}/rest/v1/comparison_sessions?id=eq.${session.id}`, {
        method: 'PATCH',
        headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_revealed: true })
    });

    return new Response(JSON.stringify({
        revealed: true,
        item: {
            id: item.id,
            name: item.name,
            brand: item.brands?.name,
            price: item.base_price,
            currency: item.currency,
            attributes: item.item_attributes
        },
        why_i_chose: generateWhyIChose(session.priorities, item)
    }), {
        headers: { ...headers, 'Content-Type': 'application/json' }
    });
}

function generateWhyIChose(priorities, item) {
    if (!priorities || !priorities.length) {
        return 'You selected this option based on your comparison.';
    }
    const priorityNames = priorities.map(p => p.attribute_id).join(', ');
    return `You prioritized ${priorityNames}. Your selected option performed strongly in these areas.`;
}

// ============================================================
// EMAIL SERVICE (Resend)
// ============================================================

async function sendEmail(body, env, headers) {
    const { to, subject, html, type } = body;
    const apiKey = env.RESEND_API_KEY;

    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'Email service not configured' }), {
            status: 503, headers: { ...headers, 'Content-Type': 'application/json' }
        });
    }

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: 'CHOZ <noreply@choz.app>',
            to: [to],
            subject,
            html
        })
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
        headers: { ...headers, 'Content-Type': 'application/json' }
    });
}

// ============================================================
// ANALYTICS
// ============================================================

async function trackEvent(body, env, headers) {
    const { event_type, user_id, metadata } = body;
    const supabaseUrl = env.SUPABASE_URL;
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

    await fetch(`${supabaseUrl}/rest/v1/analytics_events`, {
        method: 'POST',
        headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ event_type, user_id, metadata })
    });

    return new Response(JSON.stringify({ tracked: true }), {
        headers: { ...headers, 'Content-Type': 'application/json' }
    });
}
