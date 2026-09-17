import {Stack} from '@sentry/scraps/layout';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {SeerDrawerContent} from 'sentry/components/events/autofix/v3/content';
import {SeerPanelHeader} from 'sentry/components/events/autofix/v3/header';
import {useSeerPanel} from 'sentry/components/events/autofix/v3/useSeerPanel';
import {AutofixWarnings} from 'sentry/components/events/autofix/v3/warnings';
import {Placeholder} from 'sentry/components/placeholder';
import {Redirect} from 'sentry/components/redirect';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';
import {hasAutofixPage} from 'sentry/views/issueDetails/autofix/utils';
import {useGroupData} from 'sentry/views/issueDetails/groupDataContext';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

function GroupAutofix() {
  const organization = useOrganization();
  const {group, project} = useGroupData();
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
        <GroupAutofixContent group={group} project={project} />
      </AnalyticsArea>
    </SentryDocumentTitle>
  );
}

function GroupAutofixContent({group, project}: {group: Group; project: Project}) {
  const {
    aiConfig,
    autofix,
    enableBashTools,
    handleCopyMarkdown,
    handleOpenSeerAgent,
    handleRestart,
    referrer,
    runState,
    setEnableBashTools,
    warnings,
  } = useSeerPanel({group, project});

  return (
    <Stack gap="lg" paddingTop="xl">
      <SeerPanelHeader
        autofixState={runState}
        enableBashTools={enableBashTools}
        onCopyMarkdown={handleCopyMarkdown}
        onEnableBashToolsChange={setEnableBashTools}
        onOpenSeerAgent={handleOpenSeerAgent}
        onReset={handleRestart}
        referrer={referrer}
      />
      <AutofixWarnings warnings={warnings} groupId={group.id} />
      {aiConfig.isAutofixSetupLoading ? (
        <Stack data-test-id="ai-setup-loading-indicator" gap="xl">
          <Placeholder height="10rem" />
          <Placeholder height="15rem" />
          <Placeholder height="15rem" />
        </Stack>
      ) : (
        <SeerDrawerContent group={group} autofix={autofix} aiConfig={aiConfig} />
      )}
    </Stack>
  );
}

export default GroupAutofix;
