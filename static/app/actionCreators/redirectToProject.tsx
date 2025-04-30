import ModalStore from 'sentry/stores/modalStore';

export async function redirectToProject(newProjectSlug: string) {
  const {default: Modal} = await import('sentry/components/modals/redirectToProject');

  ModalStore.openModal(deps => <Modal {...deps} slug={newProjectSlug} />, {});
}
