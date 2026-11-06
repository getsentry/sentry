export function getModalPortal(): HTMLDivElement {
  const existing = document.getElementById('modal-portal');
  if (existing instanceof HTMLDivElement) {
    return existing;
  }
  const portal = document.createElement('div');
  portal.id = 'modal-portal';
  portal.dataset.overlay = 'modal';
  portal.style.containerType = 'inline-size';
  return portal;
}
