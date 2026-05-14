import {useMemo, useRef} from 'react';
import {css, type Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex, Grid} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {ContextCardContent} from 'sentry/components/events/contexts/contextCard';
import {getContextMeta} from 'sentry/components/events/contexts/utils';
import {
  TreeColumn,
  TreeContainer,
} from 'sentry/components/events/eventTags/eventTagsTree';
import {EventTagsTreeRow} from 'sentry/components/events/eventTags/eventTagsTreeRow';
import {useIssueDetailsColumnCount} from 'sentry/components/events/eventTags/util';
import {EditHighlightsModal} from 'sentry/components/events/highlights/editHighlightsModal';
import {
  EMPTY_HIGHLIGHT_DEFAULT,
  getHighlightContextData,
  getHighlightTagData,
} from 'sentry/components/events/highlights/util';
import {LoadingError} from 'sentry/components/loadingError';
import {Placeholder} from 'sentry/components/placeholder';
import {IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {DetailedProject, Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import {useReplayData} from 'sentry/utils/replays/hooks/useReplayData';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';

interface HighlightsDataSectionProps {
  event: Event;
  project: Project;
}

function useOpenEditHighlightsModal({
  highlightsProject,
  event,
}: {
  event: Event;
  highlightsProject?: DetailedProject;
}) {
  const {openModal} = useModal();

  const theme = useTheme();
  const organization = useOrganization();
  const isProjectAdmin = hasEveryAccess(['project:admin'], {
    organization,
    project: highlightsProject,
  });

  const editProps = useMemo(
    () => ({
      disabled: !isProjectAdmin,
      title: isProjectAdmin ? undefined : t('Only Project Admins can edit highlights.'),
    }),
    [isProjectAdmin]
  );

  const openEditHighlightsModal = () => {
    if (!highlightsProject) {
      return;
    }

    trackAnalytics('highlights.issue_details.edit_clicked', {organization});
    openModal(
      deps => (
        <EditHighlightsModal
          event={event}
          highlightContext={highlightsProject.highlightContext ?? {}}
          highlightTags={highlightsProject.highlightTags ?? []}
          highlightPreset={highlightsProject.highlightPreset}
          project={highlightsProject}
          {...deps}
        />
      ),
      {modalCss: highlightModalCss(theme)}
    );
  };

  return {openEditHighlightsModal, editProps};
}

function EditHighlightsButton({
  highlightsProject,
  event,
}: {
  event: Event;
  highlightsProject?: DetailedProject;
}) {
  const {openEditHighlightsModal, editProps} = useOpenEditHighlightsModal({
    highlightsProject,
    event,
  });
  return (
    <Button
      size="xs"
      icon={<IconEdit />}
      onClick={openEditHighlightsModal}
      tooltipProps={{title: editProps.title}}
      disabled={!highlightsProject || editProps.disabled}
    >
      {t('Edit')}
    </Button>
  );
}

interface HighlightsDataProps {
  event: Event;
  highlightsProject: DetailedProject;
  project: Project;
}

function HighlightsData({highlightsProject, event, project}: HighlightsDataProps) {
  const organization = useOrganization();
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const columnCount = useIssueDetailsColumnCount(containerRef);
  const {openEditHighlightsModal, editProps} = useOpenEditHighlightsModal({
    highlightsProject,
    event,
  });

  const highlightContext = useMemo(
    () => highlightsProject.highlightContext ?? {},
    [highlightsProject]
  );
  const highlightTags = useMemo(
    () => highlightsProject.highlightTags ?? [],
    [highlightsProject]
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
    location,
  });
  const highlightTagItems = getHighlightTagData({event, highlightTags});

  // find the replayId from either context or tags, if it exists
  const contextReplayItem = highlightContextDataItems.find(
    e => e.data.length && e.data[0]!.key === 'replay_id'
  );
  const contextReplayId = contextReplayItem?.value ?? EMPTY_HIGHLIGHT_DEFAULT;

  const tagReplayItem = highlightTagItems.find(e => e.originalTag.key === 'replayId');
  const tagReplayId = tagReplayItem?.value ?? EMPTY_HIGHLIGHT_DEFAULT;

  // if the id doesn't exist for either tag or context, it's rendered as '--'
  const replayId: string | undefined =
    contextReplayId === EMPTY_HIGHLIGHT_DEFAULT
      ? tagReplayId === EMPTY_HIGHLIGHT_DEFAULT
        ? undefined
        : tagReplayId
      : contextReplayId;

  const {fetchError: replayFetchError} = useReplayData({
    orgSlug: organization.slug,
    replayId,
  });

  // if fetchError, replace the replayId so we don't link to an invalid replay
  if (contextReplayItem && replayFetchError) {
    contextReplayItem.value = EMPTY_HIGHLIGHT_DEFAULT;
  }
  if (tagReplayItem && replayFetchError) {
    tagReplayItem.value = EMPTY_HIGHLIGHT_DEFAULT;
    tagReplayItem.originalTag.value = EMPTY_HIGHLIGHT_DEFAULT;
  }

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

  const highlightTagRows = highlightTagItems.map((content, i) => (
    <EventTagsTreeRow
      key={`highlight-tag-${i}`}
      content={content}
      event={event}
      tagKey={content.originalTag.key}
      project={highlightsProject}
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

  return (
    <HighlightContainer columnCount={columnCount} ref={containerRef}>
      {hasDisabledHighlights ? (
        <EmptyHighlights align="center" justify="center">
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

export function HighlightsDataSection({event, project}: HighlightsDataSectionProps) {
  const organization = useOrganization();
  const {
    data: highlightsProject,
    isError,
    refetch,
  } = useDetailedProject({
    orgSlug: organization.slug,
    projectSlug: project.slug,
  });

  return (
    <FoldSection
      sectionKey={SectionKey.HIGHLIGHTS}
      title={t('Highlights')}
      actions={
        <ErrorBoundary mini>
          <EditHighlightsButton highlightsProject={highlightsProject} event={event} />
        </ErrorBoundary>
      }
    >
      <ErrorBoundary mini message={t('There was an error loading event highlights')}>
        {isError ? (
          <LoadingError onRetry={refetch} />
        ) : highlightsProject ? (
          <HighlightsData
            event={event}
            project={project}
            highlightsProject={highlightsProject}
          />
        ) : (
          <HighlightsDataLoading />
        )}
      </ErrorBoundary>
    </FoldSection>
  );
}

function HighlightsDataLoading() {
  const containerRef = useRef<HTMLDivElement>(null);
  const columnCount = useIssueDetailsColumnCount(containerRef);

  return (
    <HighlightContainer
      columnCount={columnCount}
      ref={containerRef}
      data-test-id="highlights-loading"
    >
      {Array.from({length: columnCount}, (_, columnIndex) => (
        <HighlightColumn key={columnIndex}>
          {Array.from({length: 4}, (_row, rowIndex) => (
            <HighlightLoadingRow key={rowIndex} align="center" columns="subgrid">
              <HighlightLoadingKey>
                <HighlightKeyPlaceholder
                  height="14px"
                  width={rowIndex % 2 === 0 ? '64%' : '48%'}
                />
              </HighlightLoadingKey>
              <HighlightLoadingValue align="center" columns="1fr">
                <HighlightValuePlaceholder
                  height="14px"
                  width={rowIndex % 2 === 0 ? '82%' : '58%'}
                />
              </HighlightLoadingValue>
            </HighlightLoadingRow>
          ))}
        </HighlightColumn>
      ))}
    </HighlightContainer>
  );
}

const HighlightContainer = styled(TreeContainer)<{columnCount: number}>`
  margin-top: 0;
  margin-bottom: ${p => p.theme.space.xl};
`;

const EmptyHighlights = styled(Flex)`
  padding: ${p => p.theme.space.xl} ${p => p.theme.space.md};
  border-radius: ${p => p.theme.radius.md};
  border: 1px dashed ${p => p.theme.tokens.border.transparent.neutral.muted};
  background: ${p => p.theme.tokens.background.secondary};
  grid-column: 1 / -1;
  text-align: center;
  color: ${p => p.theme.tokens.content.secondary};
`;

const EmptyHighlightsContent = styled('div')`
  text-align: center;
`;

const AddHighlightsButton = styled(Button)`
  display: block;
  margin: ${p => p.theme.space.md} auto 0;
`;

const HighlightColumn = styled(TreeColumn)`
  grid-column: span 1;
`;

const HighlightLoadingRow = styled(Grid)`
  border-radius: ${p => p.theme.space.xs};
  padding-left: ${p => p.theme.space.md};
  grid-column: span 2;
  column-gap: ${p => p.theme.space.lg};
  min-height: 24px;

  :nth-child(odd) {
    background-color: ${p => p.theme.tokens.background.secondary};
  }
`;

const HighlightLoadingKey = styled('div')`
  grid-column: 1 / 2;
`;

const HighlightLoadingValue = styled(Grid)`
  grid-column: 2 / 3;
`;

const HighlightKeyPlaceholder = styled(Placeholder)`
  align-self: center;
`;

const HighlightValuePlaceholder = styled(Placeholder)`
  align-self: center;
`;

const HighlightContextContent = styled(ContextCardContent)`
  font-size: ${p => p.theme.font.size.sm};
`;

const highlightModalCss = (theme: Theme) => css`
  width: 850px;
  padding: 0 ${theme.space.xl};
  margin: ${theme.space.xl} 0;
  /* Disable overriding margins with breakpoint on default modal */
  @media (min-width: ${theme.breakpoints.md}) {
    margin: ${theme.space.xl} 0;
    padding: 0 ${theme.space.xl};
  }
`;
