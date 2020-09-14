type Props = {
  orgId: string; // actual id, not slug
  version: '1' | '2';
};

const SwitchReleasesButton = (_props: Props) => {
  // we are forcing everyone to version 2 now, we will delete the codebase behind v1 in a week or so
  return null;
};

export default SwitchReleasesButton;
