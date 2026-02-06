import {ExternalLink} from '@sentry/scraps/link';

import type {ContentBlock} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {tct} from 'sentry/locale';

export const tracePropagationBlock: ContentBlock = {
  type: 'alert',
  alertType: 'info',
  text: tct(
    `To see replays for backend errors, ensure that you have set up trace propagation. To learn more, [link:read the docs].`,
    {
      link: (
        <ExternalLink href="https://docs.sentry.io/product/explore/session-replay/web/getting-started/#replays-for-backend-errors" />
      ),
    }
  ),
};
