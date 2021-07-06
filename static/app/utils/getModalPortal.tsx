import memoize from 'lodash/memoize';

const getModalPortal = memoize(() => {
  let portal = document.getElementById('modal-portal') as HTMLDivElement;
  if (!portal) {
    portal = document.createElement('div');
    portal.setAttribute('id', 'modal-portal');
    document.body.appendChild(portal);
  }

  return portal;
});

export default getModalPortal;
