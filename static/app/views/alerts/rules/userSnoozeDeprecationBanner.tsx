import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {ExternalLink} from '@sentry/scraps/link';

import {usePrompt} from 'sentry/actionCreators/prompts';
import {IconClose} from 'sentry/icons';
import {tct} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

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
      variant="info"
      trailingItems={
        <Button
          aria-label="Dismiss banner"
          icon={<IconClose variant="accent" />}
          variant="transparent"
          onClick={dismissPrompt}
          size="zero"
        />
      }
    >
      {tct(
        'Individual user snoozing is no longer supported. Please read these [FAQLink:FAQs] for more information.',
        {
          FAQLink: (
            <ExternalLink href="https://www.sentry.help/en/articles/13963998-where-is-the-mute-for-me-button" />
          ),
        }
      )}
    </Alert>
  );
}
