import styled from '@emotion/styled';

import {getOrderedContextItems} from 'sentry/components/events/contexts';
import {TagColumn} from 'sentry/components/events/eventTags/eventTagsTree';
import {TagRow} from 'sentry/components/events/eventTags/eventTagsTreeRow';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {Event, EventTag, Group, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import {useDetailedProject} from 'sentry/utils/useDetailedProject';
import useOrganization from 'sentry/utils/useOrganization';

interface HighlightsSectionProps {
  columnCount: number;
  event: Event;
  group: Group;
  project: Project;
}

export default function HighlightsColumns({
  event,
  project,
  columnCount,
}: HighlightsSectionProps) {
  const organization = useOrganization();
  const {isLoading, data} = useDetailedProject({
    orgSlug: organization.slug,
    projectSlug: project.slug,
  });

  if (isLoading) {
    return <LoadingIndicator />;
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

  const tagMap: Record<string, {meta: Record<string, any>; tag: EventTag}> =
    event.tags.reduce((tm, tag, i) => {
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
  return columns;
}

const HighlightColumn = styled(TagColumn)`
  grid-column: span 1;
`;

const ContextTagRow = styled(TagRow)`
  .row-key {
    text-transform: capitalize;
  }
`;
