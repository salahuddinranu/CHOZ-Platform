// ============================================================
// CHOZ TOAST NOTIFICATION SYSTEM
// Replaces alert() with beautiful animated toasts
// ============================================================

(function() {
    // Create container if not exists
    function ensureContainer() {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 380px;
                width: calc(100vw - 40px);
                pointer-events: none;
            `;
            document.body.appendChild(container);
        }
        return container;
    }

    const ICONS = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    const COLORS = {
        success: { bg: '#dcfce7', border: '#22c55e', text: '#166534', icon: '#22c55e' },
        error: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b', icon: '#ef4444' },
        warning: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', icon: '#f59e0b' },
        info: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af', icon: '#3b82f6' }
    };

    window.showToast = function(message, type = 'info', duration = 3500) {
        const container = ensureContainer();
        const colors = COLORS[type] || COLORS.info;
        const icon = ICONS[type] || ICONS.info;

        const toast = document.createElement('div');
        toast.style.cssText = `
            background: ${colors.bg};
            border-left: 4px solid ${colors.border};
            color: ${colors.text};
            padding: 14px 18px;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.12);
            font-size: 14px;
            font-weight: 500;
            display: flex;
            align-items: flex-start;
            gap: 12px;
            pointer-events: auto;
            transform: translateX(400px);
            opacity: 0;
            transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s;
            line-height: 1.4;
            word-break: break-word;
        `;

        toast.innerHTML = `
            <span style="
                background: ${colors.icon};
                color: white;
                width: 22px;
                height: 22px;
                border-radius: 50%;
                display: grid;
                place-items: center;
                font-size: 12px;
                font-weight: 700;
                flex-shrink: 0;
                margin-top: 1px;
            ">${icon}</span>
            <span style="flex: 1;">${escapeToastHtml(message)}</span>
            <button onclick="this.parentElement.remove()" style="
                background: none;
                border: none;
                color: ${colors.text};
                opacity: 0.5;
                cursor: pointer;
                font-size: 18px;
                line-height: 1;
                padding: 0;
                margin-left: 4px;
                flex-shrink: 0;
            " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.5'">×</button>
        `;

        container.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(0)';
            toast.style.opacity = '1';
        });

        // Auto-dismiss
        const timer = setTimeout(() => {
            toast.style.transform = 'translateX(400px)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 350);
        }, duration);

        // Pause on hover
        toast.addEventListener('mouseenter', () => clearTimeout(timer));
        toast.addEventListener('mouseleave', () => {
            setTimeout(() => {
                toast.style.transform = 'translateX(400px)';
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 350);
            }, 1000);
        });

        return toast;
    };

    function escapeToastHtml(s) {
        if (!s) return '';
        return String(s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    // Convenience shortcuts
    window.toastSuccess = (msg, dur) => window.showToast(msg, 'success', dur);
    window.toastError = (msg, dur) => window.showToast(msg, 'error', dur);
    window.toastWarning = (msg, dur) => window.showToast(msg, 'warning', dur);
    window.toastInfo = (msg, dur) => window.showToast(msg, 'info', dur);

    // Override alert() globally (optional but useful)
    const originalAlert = window.alert;
    window.alert = function(message) {
        // Detect type from message content
        const msg = String(message || '');
        let type = 'info';
        if (msg.match(/error|fail|could not|cannot|invalid/i)) type = 'error';
        else if (msg.match(/success|saved|added|✓|✅/i)) type = 'success';
        else if (msg.match(/warning|⚠|careful/i)) type = 'warning';
        window.showToast(msg, type, 4500);
    };
})();
