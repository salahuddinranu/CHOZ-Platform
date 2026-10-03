// ============================================================
// CHOZ EMAIL API — Resend integration
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
        if (!env.RESEND_API_KEY) {
            return new Response(JSON.stringify({
                error: 'Email service not configured'
            }), { status: 503, headers: corsHeaders });
        }

        const { type, to, data } = await request.json();

        if (!type || !to) {
            return new Response(JSON.stringify({
                error: 'Missing required fields: type, to'
            }), { status: 400, headers: corsHeaders });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(to)) {
            return new Response(JSON.stringify({ error: 'Invalid email' }), {
                status: 400, headers: corsHeaders
            });
        }

        let subject, html;
        switch (type) {
            case 'welcome':
                subject = 'Welcome to CHOZ — Choose without the noise';
                html = welcomeTemplate(data?.name || 'there');
                break;
            default:
                return new Response(JSON.stringify({ error: 'Unknown email type' }), {
                    status: 400, headers: corsHeaders
                });
        }

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
            return new Response(JSON.stringify({
                error: 'Email could not be sent',
                detail: result.message || 'Resend API error'
            }), { status: 502, headers: corsHeaders });
        }

        return new Response(JSON.stringify({
            success: true,
            id: result.id
        }), { status: 200, headers: corsHeaders });

    } catch (err) {
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
            <div style="text-align: center; margin: 32px 0;">
                <a href="https://choz-platform.pages.dev" style="display: inline-block; background: #3A3FD9; color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600;">Start Comparing</a>
            </div>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
            <p style="font-size: 13px; color: #888; text-align: center;">
                CHOZ — "Choose without the noise."<br>
                Web owned and created by Salahuddin Ranu.
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
