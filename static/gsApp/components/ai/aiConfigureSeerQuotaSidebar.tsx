import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Placeholder} from 'sentry/components/placeholder';
import {IconOpen} from 'sentry/icons/iconOpen';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  AutofixContent,
  type AutofixContentProps,
} from 'sentry/views/issueDetails/streamline/sidebar/autofixSection';

import {useSubscription} from 'getsentry/hooks/useSubscription';
import {hasAccessToSubscriptionOverview} from 'getsentry/utils/billing';

export function AiConfigureSeerQuotaSidebar({
  aiConfig,
  group,
  project,
  event,
}: AutofixContentProps) {
  const organization = useOrganization();
  const subscription = useSubscription();

  if (aiConfig.isAutofixSetupLoading) {
    return <Placeholder height="160px" />;
  }

  const hasAutofixQuota =
    aiConfig.hasAutofixQuota || !organization.features.includes('seer-billing');

  if (hasAutofixQuota) {
    return (
      <AutofixContent aiConfig={aiConfig} group={group} project={project} event={event} />
    );
  }

  const hasBillingPerms = hasAccessToSubscriptionOverview(subscription, organization);

  return (
    <Flex direction="column" border="muted" radius="md" padding="lg" gap="lg">
      <Text bold>{t('Meet Seer, your AI assistant')}</Text>
      <Text>
        {t(
          'Debug faster with Sentry’s agent, Seer. Seer connects to your repos, scans your issues, highlights quick fixes, and proposes solutions. You can even integrate with your favorite agent to implement changes in code.'
        )}
      </Text>
      <Flex>
        <Tooltip
          title={t(
            'You need to be a billing member to try out Seer. Please contact your organization owner to upgrade your plan.'
          )}
          disabled={hasBillingPerms}
        >
          <LinkButton
            to={`/settings/${organization.slug}/billing/overview/?product=seer`}
            icon={<IconOpen />}
            disabled={!hasBillingPerms}
          >
            {t('Try out Seer now')}
          </LinkButton>
        </Tooltip>
      </Flex>
    </Flex>
  );
}
