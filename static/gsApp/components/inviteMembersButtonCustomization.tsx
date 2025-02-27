import type {Organization} from 'sentry/types/organization';

type Props = {
  children: (opts: {disabled: boolean; onTriggerModal: () => void}) => React.ReactElement;
  onTriggerModal: () => void;
  organization: Organization;
};

const InviteMembersButtonCustomization = ({children, onTriggerModal}: Props) => {
  return children({disabled: false, onTriggerModal});
};

export default InviteMembersButtonCustomization;
