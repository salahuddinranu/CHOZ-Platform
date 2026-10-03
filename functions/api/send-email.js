// ============================================================
// CHOZ EMAIL API — Resend integration
// Server-side only. Never expose RESEND_API_KEY to frontend.
// ============================================================

export async function onRequestPost(context) {
    const { request, env } = context;

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };

    try {
        // Check API key is configured
        if (!env.RESEND_API_KEY) {
            return new Response(JSON.stringify({
                error: 'Email service not configured',
                detail: 'RESEND_API_KEY environment variable is missing.'
            }), { status: 503, headers: corsHeaders });
        }

        const body = await request.json();
        const { type, to, data } = body;

        if (!type || !to) {
            return new Response(JSON.stringify({
                error: 'Missing required fields: type, to'
            }), { status: 400, headers: corsHeaders });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(to)) {
            return new Response(JSON.stringify({ error: 'Invalid email' }), {
                status: 400, headers: corsHeaders
            });
        }

        // Select template
        let subject, html;
        switch (type) {
            case 'welcome':
                subject = 'Welcome to CHOZ — Choose without the noise';
                html = welcomeTemplate(data?.name || 'there');
                break;
            case 'decision_saved':
                subject = 'Your decision was saved on CHOZ';
                html = decisionSavedTemplate(data);
                break;
            case 'price_alert':
                subject = `Price alert: ${data?.itemName || 'Item'}`;
                html = priceAlertTemplate(data);
                break;
            default:
                return new Response(JSON.stringify({ error: 'Unknown email type' }), {
                    status: 400, headers: corsHeaders
                });
        }

        // Send via Resend
        const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: `CHOZ <${env.SENDER_EMAIL || 'onboarding@resend.dev'}>`,
                to: [to],
                subject,
                html
            })
        });

        const result = await resendResponse.json();

        if (!resendResponse.ok) {
            console.error('Resend error:', result);
            return new Response(JSON.stringify({
                error: 'Email could not be sent',
                detail: result.message || 'Resend API returned an error'
            }), { status: 502, headers: corsHeaders });
        }

        return new Response(JSON.stringify({
            success: true,
            id: result.id
        }), { status: 200, headers: corsHeaders });

    } catch (err) {
        console.error('Send email error:', err);
        return new Response(JSON.stringify({
            error: 'Server error',
            detail: err.message
        }), { status: 500, headers: corsHeaders });
    }
}

export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
    });
}

// ============================================================
// EMAIL TEMPLATES
// ============================================================

function welcomeTemplate(name) {
    return `
        <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; color: #1a1a1a;">
            <div style="text-align: center; margin-bottom: 32px;">
                <div style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #3A3FD9, #7C3AED); border-radius: 12px; color: white; font-size: 20px; font-weight: 700; letter-spacing: 2px;">CHOZ</div>
            </div>

            <h1 style="font-size: 28px; margin-bottom: 12px;">Welcome, ${escapeHtml(name)}.</h1>
            <p style="font-size: 16px; line-height: 1.6; color: #555;">
                Thanks for joining CHOZ — the blind decision platform.
            </p>
            <p style="font-size: 16px; line-height: 1.6; color: #555;">
                Here's what you can do now:
            </p>
            <ul style="font-size: 15px; line-height: 1.9; color: #555;">
                <li>Pick a category — phones, bikes, hotels, laptops, and more</li>
                <li>View anonymous options without brand names</li>
                <li>Set your priorities in your own order</li>
                <li>Lock your choice, then reveal the brand</li>
                <li>Save your decision to Memory</li>
            </ul>

            <div style="text-align: center; margin: 32px 0;">
                <a href="https://choz-platform.pages.dev" style="display: inline-block; background: #3A3FD9; color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px;">Start Comparing</a>
            </div>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
            <p style="font-size: 13px; color: #888; text-align: center;">
                CHOZ — "Choose without the noise."<br>
                Web owned and created by Salahuddin Ranu.
            </p>
        </div>
    `;
}

function decisionSavedTemplate(data) {
    return `
        <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; color: #1a1a1a;">
            <h2 style="font-size: 22px;">Your decision was saved</h2>
            <p style="color: #555;">You saved a decision to your Memory on CHOZ:</p>
            <div style="background: #f5f7fa; padding: 20px; border-radius: 12px; margin: 20px 0;">
                <p style="margin: 0 0 8px; font-size: 14px; color: #888;">DECISION</p>
                <p style="margin: 0; font-size: 18px; font-weight: 600;">${escapeHtml(data?.title || 'Untitled')}</p>
            </div>
            <p style="color: #555;">Revisit it any time from your dashboard.</p>
            <p style="font-size: 13px; color: #888; text-align: center; margin-top: 32px;">
                CHOZ — Choose without the noise.
            </p>
        </div>
    `;
}

function priceAlertTemplate(data) {
    return `
        <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; color: #1a1a1a;">
            <h2 style="font-size: 22px;">Price alert</h2>
            <p style="color: #555;">${escapeHtml(data?.itemName || 'An item')} price has changed.</p>
            <p style="font-size: 13px; color: #888; text-align: center; margin-top: 32px;">
                CHOZ — Choose without the noise.
            </p>
        </div>
    `;
}

function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}
