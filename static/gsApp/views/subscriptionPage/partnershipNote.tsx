import {Prose, Text} from '@sentry/scraps/text';

import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {tct} from 'sentry/locale';

import type {Subscription} from 'getsentry/types';

const DEFAULT_MESSAGE = tct(
  'Contact us at [mailto:support@sentry.io] to make changes to your subscription.',
  {mailto: <a href="mailto:support@sentry.io" />}
);

type Props = {
  subscription: Subscription;
};

function PartnershipNote({subscription}: Props) {
  return (
    <Panel data-test-id="partnership-note">
      <PanelBody withPadding>
        {subscription.partner ? (
          // usually we pass it through sentry.utils.marked but
          // markdown doesn't support adding attributes to links
          <Prose
            as="div"
            dangerouslySetInnerHTML={{
              __html: subscription.partner?.partnership.supportNote || '',
            }}
          />
        ) : (
          <Text as="div" density="comfortable">
            {DEFAULT_MESSAGE}
          </Text>
        )}
      </PanelBody>
    </Panel>
  );
}

export default PartnershipNote;
