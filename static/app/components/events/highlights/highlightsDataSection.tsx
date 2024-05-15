import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {ContextCardContent} from 'sentry/components/events/contexts/contextCard';
import {getContextMeta} from 'sentry/components/events/contexts/utils';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {
  TreeColumn,
  TreeContainer,
} from 'sentry/components/events/eventTags/eventTagsTree';
import EventTagsTreeRow from 'sentry/components/events/eventTags/eventTagsTreeRow';
import {
  useHasNewTagsUI,
  useIssueDetailsColumnCount,
} from 'sentry/components/events/eventTags/util';
import EditHighlightsModal from 'sentry/components/events/highlights/editHighlightsModal';
import {
  EMPTY_HIGHLIGHT_DEFAULT,
  getHighlightContextData,
  getHighlightTagData,
} from 'sentry/components/events/highlights/util';
import useFeedbackWidget from 'sentry/components/feedback/widget/useFeedbackWidget';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconEdit, IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, Group, Project} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useDetailedProject} from 'sentry/utils/useDetailedProject';
import useOrganization from 'sentry/utils/useOrganization';

interface HighlightsDataSectionProps {
  event: Event;
  group: Group;
  project: Project;
  viewAllRef?: React.RefObject<HTMLElement>;
}

function HighlightsData({
  event,
  project,
  createEditAction,
}: Pick<HighlightsDataSectionProps, 'event' | 'project'> & {
  createEditAction: (action: React.ReactNode) => void;
}) {
  const organization = useOrganization();
  const containerRef = useRef<HTMLDivElement>(null);
  const columnCount = useIssueDetailsColumnCount(containerRef);
  const {isLoading, data: detailedProject} = useDetailedProject({
    orgSlug: organization.slug,
    projectSlug: project.slug,
  });

  const highlightContext = useMemo(
    () => detailedProject?.highlightContext ?? project?.highlightContext ?? {},
    [detailedProject, project]
  );
  const highlightTags = useMemo(
    () => detailedProject?.highlightTags ?? project?.highlightTags ?? [],
    [detailedProject, project]
  );

  // The API will return default values for tags/context. The only way to have none is to set it to
  // empty yourself, meaning the user has disabled highlights
  const hasDisabledHighlights =
    Object.values(highlightContext).flat().length === 0 && highlightTags.length === 0;

  const highlightContextDataItems = getHighlightContextData({
    event,
    project,
    organization,
    highlightContext,
  });
  const highlightContextRows = highlightContextDataItems.reduce<React.ReactNode[]>(
    (rowList, {alias, data}, i) => {
      const meta = getContextMeta(event, alias);
      const newRows = data.map((item, j) => (
        <HighlightContextContent
          key={`highlight-ctx-${i}-${j}`}
          meta={meta}
          item={item}
          alias={alias}
          config={{includeAliasInSubject: true}}
          data-test-id="highlight-context-row"
        />
      ));
      return [...rowList, ...newRows];
    },
    []
  );

  const highlightTagItems = getHighlightTagData({event, highlightTags});
  const highlightTagRows = highlightTagItems.map((content, i) => (
    <EventTagsTreeRow
      key={`highlight-tag-${i}`}
      content={content}
      event={event}
      tagKey={content.originalTag.key}
      project={project}
      config={{
        disableActions: content.value === EMPTY_HIGHLIGHT_DEFAULT,
        disableRichValue: content.value === EMPTY_HIGHLIGHT_DEFAULT,
      }}
      data-test-id="highlight-tag-row"
    />
  ));

  const rows = [...highlightTagRows, ...highlightContextRows];
  const columns: React.ReactNode[] = [];
  const columnSize = Math.ceil(rows.length / columnCount);
  for (let i = 0; i < rows.length; i += columnSize) {
    columns.push(
      <HighlightColumn key={`highlight-column-${i}`}>
        {rows.slice(i, i + columnSize)}
      </HighlightColumn>
    );
  }

  const openEditHighlightsModal = useCallback(() => {
    trackAnalytics('highlights.issue_details.edit_clicked', {organization});
    openModal(
      deps => (
        <EditHighlightsModal
          event={event}
          highlightContext={highlightContext}
          highlightTags={highlightTags}
          project={detailedProject ?? project}
          highlightPreset={detailedProject?.highlightPreset}
          {...deps}
        />
      ),
      {modalCss: highlightModalCss}
    );
  }, [detailedProject, event, highlightContext, highlightTags, organization, project]);

  const isProjectAdmin = hasEveryAccess(['project:admin'], {
    organization: organization,
    project: detailedProject,
  });

  const editProps = useMemo(
    () => ({
      disabled: !isProjectAdmin,
      title: !isProjectAdmin ? t('Only Project Admins can edit highlights.') : undefined,
    }),
    [isProjectAdmin]
  );

  useEffect(() => {
    createEditAction(
      <Button
        size="xs"
        icon={<IconEdit />}
        onClick={openEditHighlightsModal}
        {...editProps}
      >
        {t('Edit')}
      </Button>
    );
  }, [createEditAction, editProps, openEditHighlightsModal]);

  return (
    <HighlightContainer columnCount={columnCount} ref={containerRef}>
      {isLoading ? (
        <EmptyHighlights>
          <HighlightsLoadingIndicator hideMessage size={50} />
        </EmptyHighlights>
      ) : hasDisabledHighlights ? (
        <EmptyHighlights>
          <EmptyHighlightsContent>
            {t("There's nothing here...")}
            <AddHighlightsButton
              size="xs"
              onClick={openEditHighlightsModal}
              {...editProps}
            >
              {t('Add Highlights')}
            </AddHighlightsButton>
          </EmptyHighlightsContent>
        </EmptyHighlights>
      ) : (
        columns
      )}
    </HighlightContainer>
  );
}

function HighlightsFeedback() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const feedback = useFeedbackWidget({
    buttonRef,
    messagePlaceholder: t(
      'How can we make tags, context or highlights more useful to you?'
    ),
  });

  if (!feedback) {
    return null;
  }

  return (
    <Button
      ref={buttonRef}
      aria-label={t('Give Feedback')}
      icon={<IconMegaphone />}
      size={'xs'}
    >
      {t('Feedback')}
    </Button>
  );
}

export default function HighlightsDataSection({
  viewAllRef,
  ...props
}: HighlightsDataSectionProps) {
  const hasNewTagsUI = useHasNewTagsUI();
  const organization = useOrganization();
  // XXX: A bit convoluted to have the edit action created by the child component, but this allows
  // us to wrap it with an Error Boundary and still display the EventDataSection header if something
  // goes wrong
  const [editAction, setEditAction] = useState<React.ReactNode>(null);

  if (!hasNewTagsUI) {
    return null;
  }

  const viewAllButton = viewAllRef ? (
    <Button
      onClick={() => {
        trackAnalytics('highlights.issue_details.view_all_clicked', {organization});
        viewAllRef?.current?.scrollIntoView({behavior: 'smooth'});
      }}
      size="xs"
    >
      {t('View All')}
    </Button>
  ) : null;

  return (
    <EventDataSection
      title={t('Event Highlights')}
      data-test-id="event-highlights"
      type="event-highlights"
      actions={
        <ButtonBar gap={1}>
          <HighlightsFeedback />
          {viewAllButton}
          {editAction}
        </ButtonBar>
      }
    >
      <ErrorBoundary mini message={t('There was an error loading event highlights')}>
        <HighlightsData {...props} createEditAction={setEditAction} />
      </ErrorBoundary>
    </EventDataSection>
  );
}

const HighlightContainer = styled(TreeContainer)<{columnCount: number}>`
  margin-top: 0;
  margin-bottom: ${space(2)};
`;

const EmptyHighlights = styled('div')`
  padding: ${space(2)} ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px dashed ${p => p.theme.translucentBorder};
  background: ${p => p.theme.bodyBackground};
  grid-column: 1 / -1;
  display: flex;
  text-align: center;
  justify-content: center;
  align-items: center;
  color: ${p => p.theme.subText};
`;

const EmptyHighlightsContent = styled('div')`
  text-align: center;
`;

const HighlightsLoadingIndicator = styled(LoadingIndicator)`
  margin: 0 auto;
`;

const AddHighlightsButton = styled(Button)`
  display: block;
  margin: ${space(1)} auto 0;
`;

const HighlightColumn = styled(TreeColumn)`
  grid-column: span 1;
`;

const HighlightContextContent = styled(ContextCardContent)`
  font-size: ${p => p.theme.fontSizeSmall};
`;

export const highlightModalCss = css`
  width: 850px;
`;
