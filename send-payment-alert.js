export async function onRequestPost(context) {
    const { request, env } = context;
    const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

    try {
        const body = await request.json();
        const { userEmail, amount } = body;

        if (!env.RESEND_API_KEY) {
            return new Response(JSON.stringify({ error: 'Email service not configured' }), { status: 503, headers: corsHeaders });
        }

        // Email bhejne ke liye Resend API call
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'CHOZ Alerts <onboarding@resend.dev>',
                to: ['salahuddinranu@gmail.com'], // Aapka email
                subject: '🔔 New Pro Payment Request!',
                html: `
                    <h2>New Payment Request</h2>
                    <p>A user has submitted a payment request for CHOZ Pro.</p>
                    <ul>
                        <li><strong>User Email:</strong> ${userEmail}</li>
                        <li><strong>Amount:</strong> ${amount}</li>
                    </ul>
                    <p>Please check your Admin Panel to view the screenshot and approve.</p>
                    <a href="https://choz-platform.pages.dev/admin/">Go to Admin Panel</a>
                `
            })
        });

        if (!res.ok) throw new Error('Email failed');
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
}
