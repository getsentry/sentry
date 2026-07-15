import {Alert} from '@sentry/scraps/alert';
import {Link} from '@sentry/scraps/link';

import {tct} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

export function RelayDsnOverrideAlert() {
  const organization = useOrganization();
  const override = organization.relayDsnEndpoint;

  if (!override) {
    return null;
  }

  return (
    <Alert.Container>
      <Alert variant="info">
        {tct(
          'DSNs on this page point to the [link:custom Relay endpoint] at [override].',
          {
            link: <Link to={`/settings/${organization.slug}/relay/`} />,
            override: <code>{override}</code>,
          }
        )}
      </Alert>
    </Alert.Container>
  );
}
