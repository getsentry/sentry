import type {Organization} from 'sentry/types/organization';

interface Props {
  children: (opts: {disabled: boolean; onTriggerModal: () => void}) => React.ReactElement;
  onTriggerModal: () => void;
  organization: Organization;
}

export const InviteMembersButtonCustomization = ({children, onTriggerModal}: Props) => {
  return children({disabled: false, onTriggerModal});
};
