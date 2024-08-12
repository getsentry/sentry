import Feature from 'sentry/components/acl/feature';
import {NoAccess} from 'sentry/components/noAccess';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import type {Organization} from 'sentry/types/organization';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  children: React.ReactNode;
  organization: Organization;
};

export default function ExploreContainer({children}: Props) {
  const organization = useOrganization();

  return (
    <Feature
      // TODO: add a hook for when this is disabled
      // hookName="feature-disabled:explore-page"
      features="visibility-explore-view"
      organization={organization}
      renderDisabled={NoAccess}
    >
      <NoProjectMessage organization={organization}>{children}</NoProjectMessage>
    </Feature>
  );
}
