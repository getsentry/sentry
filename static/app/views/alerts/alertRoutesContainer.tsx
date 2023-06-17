import NoProjectMessage from 'sentry/components/noProjectMessage';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  children: React.ReactNode;
};

function AlertRoutesContainer({children}: Props) {
  const organization = useOrganization();
  return <NoProjectMessage organization={organization}>{children}</NoProjectMessage>;
}

export default AlertRoutesContainer;
