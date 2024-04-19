import {useRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {getOrderedContextItems} from 'sentry/components/events/contexts';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {TagColumn, TagContainer} from 'sentry/components/events/eventTags/eventTagsTree';
import {TagRow} from 'sentry/components/events/eventTags/eventTagsTreeRow';
import {
  useHasNewTagsUI,
  useIssueDetailsColumnCount,
} from 'sentry/components/events/eventTags/util';
import HighlightsEditModal from 'sentry/components/events/highlights/highlightsEditModal';
import {IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, EventTag, Group, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import {useDetailedProject} from 'sentry/utils/useDetailedProject';
import useOrganization from 'sentry/utils/useOrganization';

interface HighlightsSectionProps {
  event: Event;
  group: Group;
  project: Project;
  viewAllRef?: React.RefObject<HTMLElement>;
}

export type EventTagMap = Record<string, {meta: Record<string, any>; tag: EventTag}>;

export default function HighlightsDataSection({
  event,
  project,
  viewAllRef,
}: HighlightsSectionProps) {
  const hasNewTagsUI = useHasNewTagsUI();
  const containerRef = useRef<HTMLDivElement>(null);
  const organization = useOrganization();
  const {isLoading, data} = useDetailedProject({
    orgSlug: organization.slug,
    projectSlug: project.slug,
  });
  const columnCount = useIssueDetailsColumnCount(containerRef);

  if (!hasNewTagsUI) {
    return null;
  }

  const contextHighlights = data?.highlightContext ?? {};
  const contextHighlightsTypes = new Set(Object.keys(contextHighlights));
  const contextHighlightRows = getOrderedContextItems(event)
    .filter(([alias]) => contextHighlightsTypes.has(alias))
    .reduce<EventTag[]>((acc, [alias, ctx]) => {
      const newEntries: EventTag[] = (data?.highlightContext?.[alias] ?? [])
        .map(hcKey => ({
          key: `${alias}: ${hcKey}`,
          value: ctx[hcKey],
        }))
        .filter(item => defined(item.value));
      return acc.concat(newEntries);
    }, [])
    .map((item, i) => (
      <ContextTagRow key={i} projectSlug={project.slug} tag={item} meta={{}} />
    ));

  const tagMap: EventTagMap = event.tags.reduce((tm, tag, i) => {
    tm[tag.key] = {tag, meta: event._meta?.tags?.[i]};
    return tm;
  }, {});
  const tagHighlights = (data?.highlightTags ?? []).filter(tKey =>
    tagMap.hasOwnProperty(tKey)
  );
  const tagHighlightRows = tagHighlights.map((tKey, i) => (
    <TagRow key={i} projectSlug={project.slug} {...tagMap[tKey]} />
  ));

  const rows = [...contextHighlightRows, ...tagHighlightRows];

  const columns: React.ReactNode[] = [];
  const columnSize = Math.ceil(rows.length / columnCount);
  for (let i = 0; i < rows.length; i += columnSize) {
    columns.push(
      <HighlightColumn key={i}>{rows.slice(i, i + columnSize)}</HighlightColumn>
    );
  }

  const viewAllButton = viewAllRef ? (
    <Button
      onClick={() => viewAllRef?.current?.scrollIntoView({behavior: 'smooth'})}
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
          {viewAllButton}
          <Button
            size="xs"
            icon={<IconEdit />}
            onClick={() =>
              openModal(
                deps => (
                  <HighlightsEditModal
                    detailedProject={project}
                    previewRows={rows}
                    event={event}
                    tagMap={tagMap}
                    {...deps}
                  />
                ),
                {modalCss: highlightModalCss}
              )
            }
          >
            {t('Edit')}
          </Button>
        </ButtonBar>
      }
    >
      <HighlightContainer ref={containerRef} columnCount={columnCount}>
        {isLoading ? null : columns}
      </HighlightContainer>
    </EventDataSection>
  );
}

const HighlightContainer = styled(TagContainer)<{columnCount: number}>`
  margin-top: 0;
  margin-bottom: ${space(2)};
`;

const HighlightColumn = styled(TagColumn)`
  grid-column: span 1;
`;

const ContextTagRow = styled(TagRow)`
  .row-key {
    text-transform: capitalize;
  }
`;

export const highlightModalCss = css`
  width: 850px;
`;
