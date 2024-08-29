import NoProjectMessage from 'sentry/components/noProjectMessage';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import useOrganization from 'sentry/utils/useOrganization';

type Props = RouteComponentProps<{}, {}> & {
  children: React.ReactNode;
};

export default function ReplaysContainer({children}: Props) {
  const organization = useOrganization();

  return <NoProjectMessage organization={organization}>{children}</NoProjectMessage>;
}
