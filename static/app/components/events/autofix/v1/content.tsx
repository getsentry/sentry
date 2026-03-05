import {Fragment} from 'react';

import {Container, Flex} from '@sentry/scraps/layout';

import {AutofixStartBox} from 'sentry/components/events/autofix/autofixStartBox';
import {AutofixSteps} from 'sentry/components/events/autofix/autofixSteps';
import type {useAiAutofix} from 'sentry/components/events/autofix/useAutofix';
import {GroupSummary} from 'sentry/components/group/groupSummary';
import Placeholder from 'sentry/components/placeholder';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import type {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';
import {SeerNotices} from 'sentry/views/issueDetails/streamline/sidebar/seerNotices';

interface SeerDrawerContentProps {
  aiAutofix: ReturnType<typeof useAiAutofix>;
  aiConfig: ReturnType<typeof useAiConfig>;
  event: Event;
  group: Group;
  project: Project;
}

export function SeerDrawerContent({
  aiAutofix,
  aiConfig,
  event,
  group,
  project,
}: SeerDrawerContentProps) {
  useRouteAnalyticsParams({autofix_status: aiAutofix.autofixData?.status ?? 'none'});

  return (
    <Fragment>
      <SeerNotices
        groupId={group.id}
        hasGithubIntegration={aiConfig.hasGithubIntegration}
        project={project}
      />
      {aiConfig.hasSummary && (
        <Container background="primary" border="primary" radius="md" padding="xl">
          <GroupSummary
            group={group}
            event={event}
            project={project}
            collapsed={!!aiAutofix.autofixData}
          />
        </Container>
      )}
      {aiConfig.hasAutofix && (
        <Fragment>
          {aiAutofix.isPending ? (
            <Flex direction="column" gap="xl" marginTop="xl">
              <Placeholder height="15rem" />
              <Placeholder height="15rem" />
            </Flex>
          ) : aiAutofix.autofixData ? (
            <AutofixSteps
              data={aiAutofix.autofixData}
              groupId={group.id}
              runId={aiAutofix.autofixData.run_id}
              event={event}
            />
          ) : (
            <AutofixStartBox onSend={aiAutofix.triggerAutofix} groupId={group.id} />
          )}
        </Fragment>
      )}
    </Fragment>
  );
}
