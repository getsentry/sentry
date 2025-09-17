import {openModal} from 'sentry/actionCreators/modal';

export async function redirectToProject(newProjectSlug: string) {
  const {default: Modal} = await import('sentry/components/modals/redirectToProject');

  openModal(deps => <Modal {...deps} slug={newProjectSlug} />, {});
}
