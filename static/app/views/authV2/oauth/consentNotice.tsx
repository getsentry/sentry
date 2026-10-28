import {Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {tct} from 'sentry/locale';

import type {OAuthApplication} from './types';

export function ConsentFooter({application}: {application: OAuthApplication}) {
  const privacy = application.privacyUrl;
  const terms = application.termsUrl;

  return (
    <Stack paddingTop="xl" gap="lg">
      <Text as="p" size="sm" variant="muted" align="center" textWrap="balance">
        {tct(
          "You can manage or revoke this app's access anytime in [link:Account → Authorized Applications].",
          {
            link: <ExternalLink href="/settings/account/authorizations/" />,
          }
        )}
      </Text>
      {(privacy || terms) && (
        <Text as="p" size="sm" variant="muted" align="center" textWrap="balance">
          {privacy && terms
            ? tct(
                'By clicking “Authorize”, you acknowledge reviewing and agreeing to the [privacy:privacy policy] and [terms:terms of service] published by [application].',
                {
                  privacy: <ExternalLink href={privacy} />,
                  terms: <ExternalLink href={terms} />,
                  application: application.name,
                }
              )
            : privacy
              ? tct(
                  'By clicking “Authorize”, you acknowledge reviewing and agreeing to the [privacy:privacy policy] published by [application].',
                  {
                    privacy: <ExternalLink href={privacy} />,
                    application: application.name,
                  }
                )
              : tct(
                  'By clicking “Authorize”, you acknowledge reviewing and agreeing to the [terms:terms of service] published by [application].',
                  {
                    terms: <ExternalLink href={terms!} />,
                    application: application.name,
                  }
                )}
        </Text>
      )}
    </Stack>
  );
}
