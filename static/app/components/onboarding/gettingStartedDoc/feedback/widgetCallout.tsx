import {Alert} from 'sentry/components/core/alert';
import {ExternalLink} from 'sentry/components/core/link';
import type {ContentBlock} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {tct} from 'sentry/locale';

const getCalloutText = (link: string) =>
  tct(
    `Want to receive user feedback at any time, not just when an error happens? [link:Read the docs] to learn how to set up our customizable widget.`,
    {
      link: <ExternalLink href={link} />,
    }
  );

export default function widgetCallout({link}: {link: string}) {
  return (
    <Alert.Container>
      <Alert type="info">{getCalloutText(link)}</Alert>
    </Alert.Container>
  );
}

export function widgetCalloutBlock({link}: {link: string}): ContentBlock {
  return {
    type: 'alert',
    alertType: 'info',
    text: getCalloutText(link),
  };
}
