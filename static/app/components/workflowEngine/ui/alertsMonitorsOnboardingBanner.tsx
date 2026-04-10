import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {usePrompt} from 'sentry/actionCreators/prompts';
import {openAlertsMonitorsShowcase} from 'sentry/components/workflowEngine/ui/alertsMonitorsShowcase';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';

const ONBOARDING_CUTOFF_DATE = new Date('2026-05-10T00:00:00Z');

export function OnboardingBanner() {
  const organization = useOrganization();
  const user = useUser();

  // Do not show to users who joined after the GA date, they don't need this info
  const dateJoined = new Date(user.dateJoined);
  const shouldShowOnboardingBanner = dateJoined < ONBOARDING_CUTOFF_DATE;

  const {isLoading, isError, isPromptDismissed, dismissPrompt} = usePrompt({
    feature: 'workflow_engine_onboarding_banner',
    organization,
    options: {enabled: shouldShowOnboardingBanner},
  });

  if (!shouldShowOnboardingBanner || isLoading || isError || isPromptDismissed) {
    return null;
  }

  return (
    <Alert
      variant="info"
      trailingItems={
        <Button
          aria-label={t('Dismiss banner')}
          icon={<IconClose variant="accent" />}
          priority="transparent"
          onClick={() => dismissPrompt()}
          size="zero"
        />
      }
    >
      <Stack gap="xl">
        <Text as="p">
          {tct(
            '[bold:Alerts are now Monitors & Alerts.] Monitors detect problems and create issues. Issues trigger Alerts to notify your team. Your existing Alert Rules migrated automatically.',
            {bold: <strong />}
          )}
        </Text>
        <Flex gap="md" align="center">
          <Button
            size="xs"
            onClick={() => openAlertsMonitorsShowcase({organization})}
            aria-label={t('Take a tour')}
          >
            {t('Take a tour')}
          </Button>
          <ExternalLink href="https://sentry.zendesk.com/hc/en-us/articles/48882501173915">
            {t("Read what's changed")}
          </ExternalLink>
        </Flex>
      </Stack>
    </Alert>
  );
}
