export const INTERNAL_SOURCE = 'sentry:project';

// code below copied from src/sentry/static/sentry/app/views/organizationIntegrations/SplitInstallationIdModal.tsx
// TODO(PRISCILA): Make this a common function
export const onCopy = async (value: string) =>
  //This hack is needed because the normal copying methods with TextCopyInput do not work correctly
  await navigator.clipboard.writeText(value);
