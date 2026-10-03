// ============================================================
// CHOZ EMAIL SERVICE — Complete templates + Resend integration
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
        // Config check
        if (!env.RESEND_API_KEY) {
            return new Response(JSON.stringify({
                error: 'Email service not configured',
                detail: 'RESEND_API_KEY environment variable is missing.'
            }), { status: 503, headers: corsHeaders });
        }

        const body = await request.json();
        const { type, to, data } = body;

        // Validate input
        if (!type || !to) {
            return new Response(JSON.stringify({
                error: 'Missing required fields: type, to'
            }), { status: 400, headers: corsHeaders });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(to)) {
            return new Response(JSON.stringify({ error: 'Invalid email address' }), {
                status: 400, headers: corsHeaders
            });
        }

        // Template selector
        let subject, html;
        switch (type) {
            case 'welcome':
                subject = 'Welcome to CHOZ — Choose without the noise';
                html = welcomeTemplate(data);
                break;

            case 'verification':
                subject = 'Confirm your CHOZ email';
                html = verificationTemplate(data);
                break;

            case 'password_reset':
                subject = 'Reset your CHOZ password';
                html = passwordResetTemplate(data);
                break;

            case 'password_changed':
                subject = 'Your CHOZ password was changed';
                html = passwordChangedTemplate(data);
                break;

            case 'decision_saved':
                subject = 'Your decision was saved on CHOZ';
                html = decisionSavedTemplate(data);
                break;

            case 'price_alert':
                subject = `Price alert: ${data?.itemName || 'Item'}`;
                html = priceAlertTemplate(data);
                break;

            case 'contact_confirmation':
                subject = 'We received your message — CHOZ';
                html = contactConfirmationTemplate(data);
                break;

            case 'feedback_confirmation':
                subject = 'Thanks for your feedback — CHOZ';
                html = feedbackConfirmationTemplate(data);
                break;

            case 'security_alert':
                subject = 'Security alert for your CHOZ account';
                html = securityAlertTemplate(data);
                break;

            case 'account_deleted':
                subject = 'Your CHOZ account has been deleted';
                html = accountDeletedTemplate(data);
                break;

            case 'test':
                subject = 'CHOZ test email';
                html = `<p>This is a test email from CHOZ.</p>`;
                break;

            default:
                return new Response(JSON.stringify({
                    error: 'Unknown email type',
                    supported: [
                        'welcome', 'verification', 'password_reset', 'password_changed',
                        'decision_saved', 'price_alert', 'contact_confirmation',
                        'feedback_confirmation', 'security_alert', 'account_deleted', 'test'
                    ]
                }), { status: 400, headers: corsHeaders });
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

export async function onRequestGet() {
    return new Response(JSON.stringify({
        service: 'CHOZ Email Service',
        status: 'active',
        endpoints: ['POST /api/send-email'],
        supported_types: [
            'welcome', 'verification', 'password_reset', 'password_changed',
            'decision_saved', 'price_alert', 'contact_confirmation',
            'feedback_confirmation', 'security_alert', 'account_deleted', 'test'
        ]
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}

export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
    });
}

// ============================================================
// SHARED LAYOUT
// ============================================================
function emailWrapper(content) {
    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
</head>
<body style="margin:0;padding:0;background:#F6F7F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F7F9;padding:40px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
<tr><td style="padding:32px 40px 0 40px;">
<div style="text-align:center;margin-bottom:24px;">
<div style="display:inline-block;padding:10px 22px;background:linear-gradient(135deg,#3A3FD9,#7C3AED);border-radius:10px;color:#FFFFFF;font-size:18px;font-weight:700;letter-spacing:2px;">CHOZ</div>
</div>
${content}
</td></tr>
<tr><td style="padding:32px 40px 32px 40px;">
<hr style="border:none;border-top:1px solid #E5E7EB;margin:0 0 20px 0;">
<p style="font-size:12px;color:#888;text-align:center;margin:0;line-height:1.6;">
CHOZ — "Choose without the noise."<br>
Web owned and created by Salahuddin Ranu.
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function button(text, url) {
    return `<div style="text-align:center;margin:28px 0;">
<a href="${url}" style="display:inline-block;background:#3A3FD9;color:#FFFFFF;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">${text}</a>
</div>`;
}

// ============================================================
// TEMPLATES
// ============================================================

function welcomeTemplate(data) {
    const name = data?.name || 'there';
    const content = `
<h1 style="font-size:26px;margin:0 0 12px 0;color:#0F1720;">Welcome, ${escapeHtml(name)}.</h1>
<p style="font-size:15px;line-height:1.7;color:#5B6573;margin:0 0 16px 0;">
Thanks for joining CHOZ — the blind decision platform.
</p>
<p style="font-size:15px;line-height:1.7;color:#5B6573;margin:0 0 12px 0;">
Here's what you can do now:
</p>
<ul style="font-size:14px;line-height:1.9;color:#5B6573;padding-left:20px;margin:0 0 8px 0;">
<li>Pick a category — phones, bikes, hotels, laptops, and more</li>
<li>View anonymous options without brand names</li>
<li>Set your priorities in your own order</li>
<li>Lock your choice, then reveal the brand</li>
<li>Save your decision to Memory</li>
</ul>
${button('Start Comparing', 'https://choz-platform.pages.dev')}`;
    return emailWrapper(content);
}

function verificationTemplate(data) {
    const url = data?.confirmationUrl || 'https://choz-platform.pages.dev';
    const content = `
<h1 style="font-size:24px;margin:0 0 12px 0;color:#0F1720;">Confirm your email</h1>
<p style="font-size:15px;line-height:1.7;color:#5B6573;margin:0 0 16px 0;">
Thanks for signing up. Confirm your email by clicking the button below.
</p>
${button('Confirm Email', url)}
<p style="font-size:13px;color:#888;line-height:1.6;margin:0;">
If you didn't sign up, ignore this email.
</p>`;
    return emailWrapper(content);
}

function passwordResetTemplate(data) {
    const url = data?.resetUrl || 'https://choz-platform.pages.dev';
    const content = `
<h1 style="font-size:24px;margin:0 0 12px 0;color:#0F1720;">Reset your password</h1>
<p style="font-size:15px;line-height:1.7;color:#5B6573;margin:0 0 16px 0;">
Click below to reset your CHOZ password.
</p>
${button('Reset Password', url)}
<p style="font-size:13px;color:#888;line-height:1.6;margin:0;">
This link expires in 1 hour. If you didn't request this, ignore this email.
</p>`;
    return emailWrapper(content);
}

function passwordChangedTemplate(data) {
    const content = `
<h1 style="font-size:24px;margin:0 0 12px 0;color:#0F1720;">Password changed</h1>
<p style="font-size:15px;line-height:1.7;color:#5B6573;margin:0 0 16px 0;">
Your CHOZ password was changed successfully.
</p>
<p style="font-size:15px;line-height:1.7;color:#5B6573;margin:0 0 16px 0;">
If this wasn't you, secure your account immediately by resetting your password.
</p>
${button('Secure Account', 'https://choz-platform.pages.dev/dashboard.html')}`;
    return emailWrapper(content);
}

function decisionSavedTemplate(data) {
    const content = `
<h1 style="font-size:22px;margin:0 0 12px 0;color:#0F1720;">Your decision was saved</h1>
<p style="font-size:15px;line-height:1.7;color:#5B6573;margin:0 0 16px 0;">
You saved a decision to your Memory on CHOZ:
</p>
<div style="background:#F6F7F9;padding:20px;border-radius:12px;margin:0 0 20px 0;">
<p style="margin:0 0 6px 0;font-size:11px;color:#888;letter-spacing:1px;">DECISION</p>
<p style="margin:0;font-size:17px;font-weight:600;color:#0F1720;">${escapeHtml(data?.title || 'Untitled')}</p>
</div>
<p style="font-size:15px;line-height:1.7;color:#5B6573;margin:0 0 16px 0;">
Revisit it any time from your dashboard.
</p>
${button('Open Dashboard', 'https://choz-platform.pages.dev/dashboard.html')}`;
    return emailWrapper(content);
}

function priceAlertTemplate(data) {
    const content = `
<h1 style="font-size:22px;margin:0 0 12px 0;color:#0F1720;">Price alert</h1>
<p style="font-size:15px;line-height:1.7;color:#5B6573;margin:0 0 16px 0;">
${escapeHtml(data?.itemName || 'An item')} price has changed.
</p>
${data?.newPrice ? `
<div style="background:#F6F7F9;padding:20px;border-radius:12px;margin:0 0 20px 0;">
<p style="margin:0 0 6px 0;font-size:11px;color:#888;letter-spacing:1px;">NEW PRICE</p>
<p style="margin:0;font-size:20px;font-weight:700;color:#3A3FD9;">${escapeHtml(data.newPrice)}</p>
</div>` : ''}
${button('View Details', data?.itemUrl || 'https://choz-platform.pages.dev')}`;
    return emailWrapper(content);
}

function contactConfirmationTemplate(data) {
    const content = `
<h1 style="font-size:22px;margin:0 0 12px 0;color:#0F1720;">We received your message</h1>
<p style="font-size:15px;line-height:1.7;color:#5B6573;margin:0 0 16px 0;">
Hi ${escapeHtml(data?.name || 'there')},
</p>
<p style="font-size:15px;line-height:1.7;color:#5B6573;margin:0 0 16px 0;">
Thanks for reaching out to CHOZ. We've received your message and will reply within 2 business days.
</p>
${data?.subject ? `
<div style="background:#F6F7F9;padding:16px;border-radius:12px;margin:0 0 20px 0;">
<p style="margin:0 0 4px 0;font-size:11px;color:#888;letter-spacing:1px;">SUBJECT</p>
<p style="margin:0;font-size:14px;color:#0F1720;">${escapeHtml(data.subject)}</p>
</div>` : ''}
<p style="font-size:13px;color:#888;line-height:1.6;margin:0;">
— The CHOZ Team
</p>`;
    return emailWrapper(content);
}

function feedbackConfirmationTemplate(data) {
    const content = `
<h1 style="font-size:22px;margin:0 0 12px 0;color:#0F1720;">Thanks for your feedback</h1>
<p style="font-size:15px;line-height:1.7;color:#5B6573;margin:0 0 16px 0;">
Your feedback helps make CHOZ better for everyone.
</p>
<p style="font-size:15px;line-height:1.7;color:#5B6573;margin:0 0 16px 0;">
We review every message and will get back to you if needed.
</p>
${button('Back to CHOZ', 'https://choz-platform.pages.dev')}`;
    return emailWrapper(content);
}

function securityAlertTemplate(data) {
    const content = `
<h1 style="font-size:22px;margin:0 0 12px 0;color:#0F1720;">Security alert</h1>
<p style="font-size:15px;line-height:1.7;color:#5B6573;margin:0 0 16px 0;">
We noticed unusual activity on your CHOZ account:
</p>
<div style="background:#FEF3C7;padding:16px;border-radius:12px;margin:0 0 20px 0;border-left:4px solid #F59E0B;">
<p style="margin:0;font-size:14px;color:#92400E;">
${escapeHtml(data?.message || 'Unusual sign-in activity detected.')}
</p>
</div>
<p style="font-size:15px;line-height:1.7;color:#5B6573;margin:0 0 16px 0;">
If this was you, no action is needed. If not, secure your account immediately.
</p>
${button('Secure Account', 'https://choz-platform.pages.dev/dashboard.html')}`;
    return emailWrapper(content);
}

function accountDeletedTemplate(data) {
    const content = `
<h1 style="font-size:22px;margin:0 0 12px 0;color:#0F1720;">Account deleted</h1>
<p style="font-size:15px;line-height:1.7;color:#5B6573;margin:0 0 16px 0;">
Your CHOZ account and associated data have been permanently deleted.
</p>
<p style="font-size:15px;line-height:1.7;color:#5B6573;margin:0 0 16px 0;">
We're sorry to see you go. If you change your mind, you can sign up again at any time.
</p>
${button('Return to CHOZ', 'https://choz-platform.pages.dev')}`;
    return emailWrapper(content);
}

// ============================================================
// HELPERS
// ============================================================
function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}
