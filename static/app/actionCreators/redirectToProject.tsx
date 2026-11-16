import {openModal} from '@sentry/scraps/modal';

export async function redirectToProject(newProjectSlug: string) {
  const {RedirectToProjectModal} =
    await import('sentry/components/modals/redirectToProject');

  openModal(deps => <RedirectToProjectModal {...deps} slug={newProjectSlug} />, {});
}
