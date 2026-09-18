import {Stack} from '@sentry/scraps/layout';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {SeerDrawerContent} from 'sentry/components/events/autofix/v3/content';
import {AutofixWarnings} from 'sentry/components/events/autofix/v3/warnings';
import {Placeholder} from 'sentry/components/placeholder';
import {Redirect} from 'sentry/components/redirect';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useAutofixPanel} from 'sentry/views/issueDetails/autofix/context';
import {hasAutofixPage} from 'sentry/views/issueDetails/autofix/utils';
import {useGroupData} from 'sentry/views/issueDetails/groupDataContext';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

export default function GroupAutofix() {
  const organization = useOrganization();
  const {group} = useGroupData();
  const {baseUrl} = useGroupDetailsRoute();

  // The same three conditions the Seer drawer refuses to open under. Sending
  // people back to the issue keeps a shared or bookmarked URL from dead-ending.
  if (
    !hasAutofixPage(organization) ||
    !organization.features.includes('gen-ai-features') ||
    organization.hideAiFeatures
  ) {
    return <Redirect to={baseUrl} />;
  }

  return (
    <SentryDocumentTitle title={t('Autofix')} orgSlug={organization.slug}>
      <AnalyticsArea name="autofix_page">
        <GroupAutofixContent group={group} />
      </AnalyticsArea>
    </SentryDocumentTitle>
  );
}

function GroupAutofixContent({group}: {group: Group}) {
  // The provider is mounted by the layout for this tab, so this is always set.
  const panel = useAutofixPanel();

  if (!panel) {
    return null;
  }

  const {aiConfig, autofix, warnings} = panel;

  return (
    <Stack gap="lg">
      <AutofixWarnings warnings={warnings} groupId={group.id} />
      {aiConfig.isAutofixSetupLoading ? (
        <Stack data-test-id="ai-setup-loading-indicator" gap="xl">
          <Placeholder height="10rem" />
          <Placeholder height="15rem" />
          <Placeholder height="15rem" />
        </Stack>
      ) : (
        <SeerDrawerContent
          group={group}
          autofix={autofix}
          aiConfig={aiConfig}
          stickyNextStep
        />
      )}
    </Stack>
  );
}
