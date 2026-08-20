import DOMPurify from 'dompurify';

import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {tct} from 'sentry/locale';
import {TextBlock} from 'sentry/views/settings/components/text/textBlock';

import type {Subscription} from 'getsentry/types';

const DEFAULT_MESSAGE = tct(
  'Contact us at [mailto:support@sentry.io] to make changes to your subscription.',
  {mailto: <a href="mailto:support@sentry.io" />}
);

type Props = {
  subscription: Subscription;
};

export function PartnershipNote({subscription}: Props) {
  return (
    <Panel data-test-id="partnership-note">
      <PanelBody withPadding>
        {subscription.partner ? (
          // usually we pass it through sentry.utils.marked but
          // markdown doesn't support adding attributes to links
          <TextBlock
            noMargin
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(
                subscription.partner?.partnership.supportNote || '',
                // `target` is not in DOMPurify's default allowlist, and the note
                // links out to the partner's own support site.
                {ADD_ATTR: ['target']}
              ),
            }}
          />
        ) : (
          <TextBlock noMargin>{DEFAULT_MESSAGE}</TextBlock>
        )}
      </PanelBody>
    </Panel>
  );
}
