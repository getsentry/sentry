import {useRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
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
  getHighlightContextItems,
  getHighlightTagItems,
} from 'sentry/components/events/highlights/util';
import {IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, Group, Project} from 'sentry/types';
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
  const {
    isLoading,
    data: detailedProject,
    refetch,
  } = useDetailedProject({
    orgSlug: organization.slug,
    projectSlug: project.slug,
  });

  if (!hasNewTagsUI) {
    return null;
  }

  const highlightContext = detailedProject?.highlightContext ?? {};
  const highlightTags = detailedProject?.highlightTags ?? [];
  const viewAllButton = viewAllRef ? (
    <Button
      onClick={() => viewAllRef?.current?.scrollIntoView({behavior: 'smooth'})}
      size="xs"
    >
      {t('View All')}
    </Button>
  ) : null;

  const highlightContextDataItems = getHighlightContextItems({
    event,
    project,
    organization,
    highlightContext,
  });
  const highlightContextRows = highlightContextDataItems.reduce<React.ReactNode[]>(
    (rowList, [alias, items], i) => {
      const meta = getContextMeta(event, alias);
      const newRows = items.map((item, j) => (
        <HighlightContextContent
          key={`highlight-ctx-${i}-${j}`}
          meta={meta}
          item={item}
          alias={alias}
          config={{includeAliasInSubject: true}}
        />
      ));
      return [...rowList, ...newRows];
    },
    []
  );

  const highlightTagItems = getHighlightTagItems({event, highlightTags});
  const highlightTagRows = highlightTagItems.map((content, i) => (
    <EventTagsTreeRow
      key={`highlight-tag-${i}`}
      content={content}
      event={event}
      tagKey={content.originalTag.key}
      projectSlug={project.slug}
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
            onClick={() =>
              openModal(
                deps => (
                  <EditHighlightsModal
                    event={event}
                    highlightContext={highlightContext}
                    highlightTags={highlightTags}
                    project={detailedProject ?? project}
                    {...deps}
                  />
                ),
                {modalCss: highlightModalCss, onClose: refetch}
              )
            }
          >
            {t('Edit')}
          </Button>
        </ButtonBar>
      }
    >
      <HighlightContainer columnCount={columnCount} ref={containerRef}>
        {isLoading ? null : columns}
      </HighlightContainer>
    </EventDataSection>
  );
}

const HighlightContainer = styled(TreeContainer)<{columnCount: number}>`
  margin-top: 0;
  margin-bottom: ${space(2)};
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
