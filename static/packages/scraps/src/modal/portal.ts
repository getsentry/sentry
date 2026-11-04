export function getModalPortal(): HTMLDivElement {
  const existing = document.getElementById('modal-portal');
  const portal =
    existing instanceof HTMLDivElement ? existing : document.createElement('div');
  portal.id = 'modal-portal';
  portal.dataset.overlay = 'modal';
  portal.style.containerType = 'inline-size';
  if (!portal.isConnected) {
    document.body.appendChild(portal);
  }
  return portal;
}
