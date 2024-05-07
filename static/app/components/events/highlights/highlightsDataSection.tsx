import {useRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
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
  getHighlightContextData,
  getHighlightTagData,
} from 'sentry/components/events/highlights/util';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, Group, Project} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useDetailedProject} from 'sentry/utils/useDetailedProject';
import useOrganization from 'sentry/utils/useOrganization';

interface HighlightsSectionProps {
  event: Event;
  group: Group;
  project: Project;
  viewAllRef?: React.RefObject<HTMLElement>;
}

export default function HighlightsDataSection({
  event,
  project,
  viewAllRef,
}: HighlightsSectionProps) {
  const hasNewTagsUI = useHasNewTagsUI();
  const organization = useOrganization();
  const containerRef = useRef<HTMLDivElement>(null);
  const columnCount = useIssueDetailsColumnCount(containerRef);
  const {isLoading, data: detailedProject} = useDetailedProject({
    orgSlug: organization.slug,
    projectSlug: project.slug,
  });

  if (!hasNewTagsUI) {
    return null;
  }

  const highlightContext = detailedProject?.highlightContext ?? {};
  const highlightTags = detailedProject?.highlightTags ?? [];

  // The API will return default values for tags/context. The only way to have none is to set it to
  // empty yourself, meaning the user has disabled highlights
  const hasDisabledHighlights =
    Object.values(highlightContext).flat().length === 0 && highlightTags.length === 0;

  const viewAllButton = viewAllRef ? (
    <Button
      onClick={() => {
        trackAnalytics('highlights_section.view_all_clicked', {organization});
        viewAllRef?.current?.scrollIntoView({behavior: 'smooth'});
      }}
      size="xs"
    >
      {t('View All')}
    </Button>
  ) : null;

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
      projectSlug={project.slug}
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

  const isProjectAdmin = hasEveryAccess(['project:admin'], {
    organization: organization,
    project: detailedProject,
  });

  function openEditHighlightsModal() {
    trackAnalytics('highlights_section.edit_clicked', {organization});
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
  }

  const editProps = {
    disabled: !isProjectAdmin,
    title: !isProjectAdmin ? t('Only Project Admins can edit highlights.') : undefined,
  };

  return (
    <EventDataSection
      title={t('Event Highlights')}
      data-test-id="event-highlights"
      type="event-highlights"
      actions={
        <ButtonBar gap={1}>
          {viewAllButton}
          <Button
            size="xs"
            icon={<IconEdit />}
            onClick={openEditHighlightsModal}
            {...editProps}
          >
            {t('Edit')}
          </Button>
        </ButtonBar>
      }
    >
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
