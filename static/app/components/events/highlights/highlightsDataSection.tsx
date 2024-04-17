import styled from '@emotion/styled';

import {getOrderedContextItems} from 'sentry/components/events/contexts';
import ContextCard from 'sentry/components/events/contexts/contextCard';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {
  TreeKey,
  TreeRow,
  TreeValue,
} from 'sentry/components/events/eventTags/eventTagsTreeRow';
import {useHasNewTagsUI} from 'sentry/components/events/eventTags/util';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, Group, Project} from 'sentry/types';
import {useDetailedProject} from 'sentry/utils/useDetailedProject';
import useOrganization from 'sentry/utils/useOrganization';

interface HighlightsSectionProps {
  event: Event;
  group: Group;
  project: Project;
}

export default function HighlightsDataSection({
  event,
  group,
  project,
}: HighlightsSectionProps) {
  const hasNewTagsUI = useHasNewTagsUI();
  const organization = useOrganization();
  const {isLoading, data} = useDetailedProject({
    orgSlug: organization.slug,
    projectSlug: project.slug,
  });

  if (!hasNewTagsUI || isLoading) {
    return null;
  }

  const contextMap = getOrderedContextItems(event).reduce((acc, [alias, ctx]) => {
    acc[ctx.type] = {value: ctx, alias};
    return acc;
  }, {});
  const contextHighlights = data?.highlightContext ?? [];

  const tagMap = event.tags.reduce((tm, {key, value}) => {
    tm[key] = value;
    return tm;
  }, {});
  const tagHighlights = data?.highlightTags ?? [];

  return (
    <EventDataSection
      title={t('Highlighted Event Data')}
      data-test-id="highlighted-event-data"
      type="highlighted-event-data"
    >
      <HighlightWrapper>
        <ContextHighlightSection>
          {contextHighlights.map((contextType, i) => (
            <ContextCard
              key={i}
              type={contextType}
              alias={contextMap[contextType]?.alias ?? contextType}
              value={contextMap[contextType]?.value}
              group={group}
              event={event}
              project={project}
            />
          ))}
        </ContextHighlightSection>
        <TagHighlightSection>
          {tagHighlights.map((tag, i) => (
            <TreeRow hasErrors={false} key={i}>
              <TreeKey hasErrors={false}>{tag}</TreeKey>
              <TreeValue>{tagMap[tag]}</TreeValue>
            </TreeRow>
          ))}
        </TagHighlightSection>
      </HighlightWrapper>
    </EventDataSection>
  );
}

const HighlightWrapper = styled('div')`
  margin-bottom: ${space(2)};
  display: flex;
  gap: ${space(1)};
  align-items: start;
  /* TODO(Leander): Account for screen width */
`;

const ContextHighlightSection = styled('div')`
  flex: 1;
`;

const TagHighlightSection = styled('div')`
  flex: 1;
  display: grid;
  grid-template-columns: minmax(auto, 175px) 1fr;
  :nth-child(odd) {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;
