import {useRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {
  ContextCardContent,
  type ContextCardContentProps,
} from 'sentry/components/events/contexts/contextCard';
import {getContextMeta} from 'sentry/components/events/contexts/utils';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {TagColumn, TagContainer} from 'sentry/components/events/eventTags/eventTagsTree';
import EventTagsTreeRow, {
  type EventTagsTreeRowProps,
} from 'sentry/components/events/eventTags/eventTagsTreeRow';
import {
  useHasNewTagsUI,
  useIssueDetailsColumnCount,
} from 'sentry/components/events/eventTags/util';
import EditHighlightsModal from 'sentry/components/events/highlights/editHighlightsModal';
import {getHighlightContextItems} from 'sentry/components/events/highlights/util';
import {IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, EventTag, Group, Project} from 'sentry/types';
import {useDetailedProject} from 'sentry/utils/useDetailedProject';
import useOrganization from 'sentry/utils/useOrganization';

interface HighlightsSectionProps {
  event: Event;
  group: Group;
  project: Project;
  viewAllRef?: React.RefObject<HTMLElement>;
}
export type HighlightTags = Required<Project>['highlightTags'];
export type HighlightContext = Required<Project>['highlightContext'];

interface HighlightsDataContentProps {
  columnCount: number;
  event: Event;
  highlightContext: HighlightContext;
  highlightTags: HighlightTags;
  project: Project;
  contextRowProps?: Partial<ContextCardContentProps>;
  tagRowProps?: Partial<EventTagsTreeRowProps>;
}

export function HighlightsDataContent({
  event,
  columnCount,
  highlightContext,
  highlightTags,
  project,
  tagRowProps,
  contextRowProps,
  ...props
}: HighlightsDataContentProps) {
  const organization = useOrganization();

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
          {...contextRowProps}
        />
      ));
      return [...rowList, ...newRows];
    },
    []
  );

  const EMPTY_TAG_VALUE = '--';
  const tagMap: Record<string, {meta: Record<string, any>; tag: EventTag}> =
    event.tags.reduce((tm, tag, i) => {
      tm[tag.key] = {tag, meta: event._meta?.tags?.[i]};
      return tm;
    }, {});
  const highlightTagRows = highlightTags
    .filter(tagKey => tagMap.hasOwnProperty(tagKey))
    .map((tagKey, i) => (
      <EventTagsTreeRow
        key={`highlight-tag-${i}`}
        content={{
          subtree: {},
          meta: tagMap[tagKey]?.meta ?? {},
          value: tagMap[tagKey]?.tag?.value ?? EMPTY_TAG_VALUE,
          originalTag: tagMap[tagKey]?.tag ?? {key: tagKey, value: EMPTY_TAG_VALUE},
        }}
        event={event}
        tagKey={tagKey}
        projectSlug={project.slug}
        {...tagRowProps}
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
    <HighlightContainer columnCount={columnCount} {...props}>
      {columns}
    </HighlightContainer>
  );
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
      <div ref={containerRef}>
        {isLoading ? null : (
          <HighlightsDataContent
            event={event}
            project={project}
            highlightContext={highlightContext}
            highlightTags={highlightTags}
            columnCount={columnCount}
          />
        )}
      </div>
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

const HighlightContextContent = styled(ContextCardContent)`
  font-size: ${p => p.theme.fontSizeSmall};
`;

export const highlightModalCss = css`
  width: 850px;
`;
