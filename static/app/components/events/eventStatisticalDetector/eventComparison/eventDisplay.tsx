import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {EventTags} from 'sentry/components/events/eventTags';
import {MINIMAP_HEIGHT} from 'sentry/components/events/interfaces/spans/constants';
import {noFilter} from 'sentry/components/events/interfaces/spans/filter';
import {ActualMinimap} from 'sentry/components/events/interfaces/spans/header';
import WaterfallModel from 'sentry/components/events/interfaces/spans/waterfallModel';
import OpsBreakdown from 'sentry/components/events/opsBreakdown';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import TextOverflow from 'sentry/components/textOverflow';
import {IconEllipsis, IconJson, IconLink} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {EventTransaction, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {getShortEventId} from 'sentry/utils/events';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

// A hook for getting "sample events" for a transaction
// In its current state it will just fetch at most 5 events that match the
// transaction name within a range of the duration baseline provided
function useFetchSampleEvents({
  start,
  end,
  transaction,
  durationBaseline,
  projectId,
}: {
  durationBaseline: number;
  end: number;
  projectId: number;
  start: number;
  transaction: string;
}) {
  const location = useLocation();
  const organization = useOrganization();
  const eventView = new EventView({
    dataset: DiscoverDatasets.DISCOVER,
    start: new Date(start * 1000).toISOString(),
    end: new Date(end * 1000).toISOString(),
    fields: [{field: 'id'}],
    query: `event.type:transaction transaction:"${transaction}" transaction.duration:>=${
      durationBaseline * 0.7
    }ms transaction.duration:<=${durationBaseline * 1.3}ms`,

    createdBy: undefined,
    display: undefined,
    id: undefined,
    environment: [],
    name: undefined,
    project: [projectId],
    sorts: [],
    statsPeriod: undefined,
    team: [],
    topEvents: undefined,
  });

  return useDiscoverQuery({
    eventView,
    location,
    orgSlug: organization.slug,
    limit: 5,
  });
}

type EventDisplayProps = {
  durationBaseline: number;
  end: number;
  eventSelectLabel: string;
  project: Project;
  start: number;
  transaction: string;
};

function EventDisplay({
  eventSelectLabel,
  project,
  start,
  end,
  transaction,
  durationBaseline,
}: EventDisplayProps) {
  const location = useLocation();
  const organization = useOrganization();
  const [selectedEventId, setSelectedEventId] = useState<string>('');

  const {data, isLoading, isError} = useFetchSampleEvents({
    start,
    end,
    transaction,
    durationBaseline,
    projectId: parseInt(project.id, 10),
  });

  const eventIds = data?.data.map(({id}) => id);

  const {data: eventData, isFetching} = useApiQuery<EventTransaction>(
    [`/organizations/${organization.slug}/events/${project.slug}:${selectedEventId}/`],
    {staleTime: Infinity, retry: false, enabled: !!selectedEventId && !!project.slug}
  );

  useEffect(() => {
    if (defined(eventIds) && eventIds.length > 0 && !selectedEventId) {
      setSelectedEventId(eventIds[0]);
    }
  }, [eventIds, selectedEventId]);

  if (isError) {
    return null;
  }

  if (isLoading || isFetching) {
    return <LoadingIndicator />;
  }

  if (!defined(eventData) || !defined(eventIds)) {
    return (
      <EmptyStateWrapper>
        <EmptyStateWarning withIcon>
          <div>{t('Unable to find a sample event')}</div>
        </EmptyStateWarning>
      </EmptyStateWrapper>
    );
  }

  const waterfallModel = new WaterfallModel(eventData);
  return (
    <EventDisplayContainer>
      <div>
        <StyledEventSelectorControlBar>
          <CompactSelect
            size="sm"
            disabled={false}
            options={eventIds.map(id => ({value: id, label: id}))}
            value={selectedEventId}
            onChange={({value}) => setSelectedEventId(value)}
            triggerLabel={
              <ButtonLabelWrapper>
                <TextOverflow>
                  {eventSelectLabel}: {getShortEventId(selectedEventId)}
                </TextOverflow>
              </ButtonLabelWrapper>
            }
          />
          <Button aria-label="icon" icon={<IconEllipsis />} size="sm" />
          <Button aria-label="icon" icon={<IconJson />} size="sm" />
          <Button aria-label="icon" icon={<IconLink />} size="sm" />
        </StyledEventSelectorControlBar>
        <ComparisonContentWrapper>
          <MinimapContainer>
            <MinimapPositioningContainer>
              <ActualMinimap
                spans={waterfallModel.getWaterfall({
                  viewStart: 0,
                  viewEnd: 1,
                })}
                generateBounds={waterfallModel.generateBounds({
                  viewStart: 0,
                  viewEnd: 1,
                })}
                dividerPosition={0}
                rootSpan={waterfallModel.rootSpan.span}
              />
            </MinimapPositioningContainer>
          </MinimapContainer>

          <OpsBreakdown event={eventData} operationNameFilters={noFilter} hideHeader />
        </ComparisonContentWrapper>
      </div>

      <EventTags
        event={eventData}
        organization={organization}
        projectSlug={project.slug}
        location={location}
      />
    </EventDisplayContainer>
  );
}

export {EventDisplay};

const EventDisplayContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  flex-direction: column;
`;

const ButtonLabelWrapper = styled('span')`
  width: 100%;
  text-align: left;
  align-items: center;
  display: inline-grid;
  grid-template-columns: 1fr auto;
`;

const StyledEventSelectorControlBar = styled('div')`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
`;

const MinimapPositioningContainer = styled('div')`
  position: absolute;
  top: 0;
  width: 100%;
`;

const MinimapContainer = styled('div')`
  height: ${MINIMAP_HEIGHT}px;
  max-height: ${MINIMAP_HEIGHT}px;
  position: relative;
  border-bottom: 1px solid ${p => p.theme.border};
`;

const ComparisonContentWrapper = styled('div')`
  border: ${({theme}) => `1px solid ${theme.border}`};
  border-radius: ${({theme}) => theme.borderRadius};
  overflow: hidden;
`;

const EmptyStateWrapper = styled('div')`
  border: ${({theme}) => `1px solid ${theme.border}`};
  border-radius: ${({theme}) => theme.borderRadius};
  display: flex;
  justify-content: center;
  align-items: center;
`;
