import {openModal} from 'sentry/actionCreators/modal';

export async function redirectToProject(newProjectSlug: string) {
  const {RedirectToProjectModal} =
    await import('sentry/components/modals/redirectToProject');

  openModal(deps => <RedirectToProjectModal {...deps} slug={newProjectSlug} />, {});
}
