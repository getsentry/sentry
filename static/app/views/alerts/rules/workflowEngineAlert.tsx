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
          "Some aspects of alerts may not be visible if you've used the [link:new monitors and alerts UI].",
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
