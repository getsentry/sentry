import ModalStore from 'sentry/stores/modalStore';

export async function redirectToProject(newProjectSlug: string) {
  const mod = await import('sentry/components/modals/redirectToProject');
  const {default: Modal} = mod;

  ModalStore.openModal(deps => <Modal {...deps} slug={newProjectSlug} />, {});
}
