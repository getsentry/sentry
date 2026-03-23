import {Alert} from '@sentry/scraps/alert';
import {ExternalLink} from '@sentry/scraps/link';

import {tct} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

export function WorkflowEngineAlert() {
  const organization = useOrganization();

  if (!organization.features.includes('workflow-engine-rule-serializers')) {
    return null;
  }

  return (
    <Alert.Container>
      <Alert variant="warning">
        {tct(
          "The legacy alerts UI does not support all the same features as the [link:new monitors and alerts UI]. If you've created or modified an alert using the new API, those settings will be used during evaluation but aren't fully reflected in the legacy UI.",
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/product/new-monitors-and-alerts/" />
            ),
          }
        )}
      </Alert>
    </Alert.Container>
  );
}
