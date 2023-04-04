import Feature from 'sentry/components/acl/feature';
import useOrganization from 'sentry/utils/useOrganization';

import RelayWrapper from './relayWrapper';

const OrganizationRelay = (props: Omit<RelayWrapper['props'], 'organization'>) => {
  const organization = useOrganization();
  return (
    <Feature
      organization={organization}
      features={['relay']}
      hookName="feature-disabled:relay"
    >
      <RelayWrapper organization={organization} {...props} />
    </Feature>
  );
};

export default OrganizationRelay;
