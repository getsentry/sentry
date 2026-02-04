import {ExternalLink} from '@sentry/scraps/link';

import type {ContentBlock} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {tct} from 'sentry/locale';

export function widgetCalloutBlock({link}: {link: string}): ContentBlock {
  return {
    type: 'alert',
    alertType: 'info',
    text: tct(
      `Want to receive user feedback at any time, not just when an error happens? [link:Read the docs] to learn how to set up our customizable widget.`,
      {
        link: <ExternalLink href={link} />,
      }
    ),
  };
}
