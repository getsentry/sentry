import {Alert} from '@sentry/scraps/alert';

import {usePrompt} from 'sentry/actionCreators/prompts';
import {Button} from 'sentry/components/core/button';
import {ExternalLink} from 'sentry/components/core/link';
import {IconClose} from 'sentry/icons';
import {tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  projectId: string;
}

export function UserSnoozeDeprecationBanner({projectId}: Props) {
  const organization = useOrganization();

  const {isLoading, isError, isPromptDismissed, dismissPrompt} = usePrompt({
    feature: 'user_snooze_deprecation',
    organization,
    projectId,
  });

  if (isLoading || isError || isPromptDismissed) {
    return null;
  }

  return (
    <Alert
      type="info"
      trailingItems={
        <Button
          aria-label="Dismiss banner"
          icon={<IconClose color="purple400" />}
          borderless
          onClick={dismissPrompt}
          size="zero"
        />
      }
    >
      {tct(
        'Individual user snoozing is no longer supported. Please read these [FAQLink:FAQs] for more information.',
        {
          FAQLink: (
            <ExternalLink href="https://sentry.zendesk.com/hc/en-us/articles/41126598038043-Where-is-the-Mute-For-Me-button" />
          ),
        }
      )}
    </Alert>
  );
}
