let portal: HTMLDivElement | null = null;

const getModalPortal = () => {
  if (portal?.isConnected) {
    return portal;
  }

  const existingPortal = document.getElementById('modal-portal');
  if (existingPortal instanceof HTMLDivElement) {
    portal = existingPortal;
    return portal;
  }

  portal = document.createElement('div');
  portal.setAttribute('id', 'modal-portal');
  document.body.appendChild(portal);

  return portal;
};

export default getModalPortal;
