// public/js/modal.js

const Modal = {
  show(html) {
    document.getElementById('modalBox').innerHTML = html;
    document.getElementById('modalBackdrop').classList.remove('hidden');
  },
  close() {
    document.getElementById('modalBackdrop').classList.add('hidden');
    document.getElementById('modalBox').innerHTML = '';
  },
  closeOnBackdrop(e) {
    if (e.target === document.getElementById('modalBackdrop')) this.close();
  },
};

const Toast = {
  show(message, type = '') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast${type ? ' ' + type : ''}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'all 0.2s';
      setTimeout(() => toast.remove(), 200);
    }, 2800);
  },
};
