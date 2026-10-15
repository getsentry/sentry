import {Fragment} from 'react';

import {Container, Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {getOrderedAutofixSections} from 'sentry/components/events/autofix/useExplorerAutofix';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {ActivitySection} from 'sentry/views/issueDetails/activitySection';

import {getAutofixTimelineItems} from './autofixTimeline';
import {IssuePreviewAutofixSection} from './issuePreviewAutofixSection';
import {IssuePreviewSeerContent, useIssuePreviewSeer} from './issuePreviewSeer';

export function IssuePreviewTimeline({group, project}: {group: Group; project: Project}) {
  const previewSeer = useIssuePreviewSeer();
  const {autofix, state} = previewSeer;
  const {runState} = autofix;
  const sections =
    state === 'summary' || state === 'configure'
      ? getOrderedAutofixSections(runState)
      : [];
  const timelineItems = getAutofixTimelineItems(
    group.activity,
    runState?.run_id,
    sections
  );
  const timelineSteps = timelineItems.reduce((steps, {section}) => {
    if (section) {
      steps.add(section.step);
    }
    return steps;
  }, new Set<string>());
  const items = timelineItems.map(item => {
    const {section} = item;
    if (!section) {
      return item;
    }
    return {
      ...item,
      body: (
        <Container paddingTop="md">
          <ErrorBoundary mini>
            <IssuePreviewAutofixSection
              autofix={autofix}
              groupId={group.id}
              section={section}
              readOnly={state === 'configure'}
            />
          </ErrorBoundary>
        </Container>
      ),
    };
  });

  return (
    <Fragment>
      <IssuePreviewSeerContent
        group={group}
        project={project}
        previewSeer={previewSeer}
        excludeSteps={timelineSteps}
      />
      <Stack as="section" aria-label={t('Issue Timeline')} gap="xl">
        <Heading as="h3" size="md">
          {t('Issue Timeline')}
        </Heading>
        <ErrorBoundary mini>
          <ActivitySection
            group={group}
            minHeight={40}
            variant="standalone"
            inputPosition="end"
            placeholder={t('Add a comment. Tag users with @, or teams with #')}
            items={items}
          />
        </ErrorBoundary>
      </Stack>
    </Fragment>
  );
}
