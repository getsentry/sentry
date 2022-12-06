import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {
  getStacktrace,
  StackTracePreviewContent,
} from 'sentry/components/groupPreviewTooltip/stackTracePreview';
import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Event, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventView from 'sentry/utils/discover/eventView';
import {getDuration} from 'sentry/utils/formatters';
import TraceMetaQuery from 'sentry/utils/performance/quickTrace/traceMetaQuery';
import {getTraceTimeRangeFromEvent} from 'sentry/utils/performance/quickTrace/utils';
import {useQuery} from 'sentry/utils/queryClient';
import {
  getStatusBodyText,
  HttpStatus,
} from 'sentry/views/performance/transactionDetails/eventMetas';

import {
  ContextBody,
  ContextContainer,
  ContextHeader,
  ContextRow,
  NoContextWrapper,
  StyledIconAdd,
  Wrapper,
} from './styles';
import {
  addFieldAsColumn,
  BaseContextProps,
  ContextType,
  fiveMinutesInMs,
  NoContext,
} from './utils';

interface EventContextProps extends BaseContextProps {
  eventView?: EventView;
  location?: Location;
  projects?: Project[];
}

function EventContext(props: EventContextProps) {
  const {organization, dataRow, eventView, location, projects} = props;
  const {isLoading, isError, data} = useQuery<Event>(
    [
      `/organizations/${organization.slug}/events/${dataRow['project.name']}:${dataRow.id}/`,
    ],
    {
      staleTime: fiveMinutesInMs,
    }
  );

  useEffect(() => {
    if (data) {
      trackAdvancedAnalyticsEvent('discover_v2.quick_context_hover_contexts', {
        organization,
        contextType: ContextType.EVENT,
        eventType: data.type,
      });
    }
  }, [data, organization]);

  if (isLoading || isError) {
    return <NoContext isLoading={isLoading} />;
  }

  if (data.type === 'transaction') {
    const traceId = data.contexts?.trace?.trace_id ?? '';
    const {start, end} = getTraceTimeRangeFromEvent(data);
    const project = projects?.find(p => p.slug === data.projectID);
    return (
      <Wrapper data-test-id="quick-context-hover-body">
        <EventContextContainer>
          <ContextHeader>
            {t('Transaction Duration')}
            {!('transaction.duration' in dataRow) && (
              <Tooltip
                skipWrapper
                title={t('Add transaction duration as a column')}
                position="right"
              >
                <StyledIconAdd
                  data-test-id="quick-context-transaction-duration-add-button"
                  cursor="pointer"
                  onClick={() =>
                    addFieldAsColumn(
                      'transaction.duration',
                      organization,
                      location,
                      eventView
                    )
                  }
                  color="gray300"
                  size="xs"
                  isCircled
                />
              </Tooltip>
            )}
          </ContextHeader>
          <EventContextBody>
            {getDuration(data.endTimestamp - data.startTimestamp, 2, true)}
          </EventContextBody>
        </EventContextContainer>
        {location && (
          <EventContextContainer>
            <ContextHeader>
              {t('Status')}
              {!('http.status_code' in dataRow) && (
                <Tooltip
                  skipWrapper
                  title={t('Add HTTP status code as a column')}
                  position="right"
                >
                  <StyledIconAdd
                    data-test-id="quick-context-http-status-add-button"
                    cursor="pointer"
                    onClick={() =>
                      addFieldAsColumn(
                        'http.status_code',
                        organization,
                        location,
                        eventView
                      )
                    }
                    color="gray300"
                    size="xs"
                    isCircled
                  />
                </Tooltip>
              )}
            </ContextHeader>
            <EventContextBody>
              <ContextRow>
                <TraceMetaQuery
                  location={location}
                  orgSlug={organization.slug}
                  traceId={traceId}
                  start={start}
                  end={end}
                >
                  {metaResults => getStatusBodyText(project, data, metaResults?.meta)}
                </TraceMetaQuery>
                <HttpStatusWrapper>
                  (<HttpStatus event={data} />)
                </HttpStatusWrapper>
              </ContextRow>
            </EventContextBody>
          </EventContextContainer>
        )}
      </Wrapper>
    );
  }

  const stackTrace = getStacktrace(data);

  return stackTrace ? (
    <Fragment>
      {!dataRow.title && (
        <ErrorTitleContainer>
          <ContextHeader>
            {t('Title')}
            {!('title' in dataRow) && (
              <Tooltip skipWrapper title={t('Add title as a column')} position="right">
                <StyledIconAdd
                  data-test-id="quick-context-title-add-button"
                  cursor="pointer"
                  onClick={() =>
                    addFieldAsColumn('title', organization, location, eventView)
                  }
                  color="gray300"
                  size="xs"
                  isCircled
                />
              </Tooltip>
            )}
          </ContextHeader>
          <ErrorTitleBody>{data.title}</ErrorTitleBody>
        </ErrorTitleContainer>
      )}
      <StackTraceWrapper>
        <StackTracePreviewContent event={data} stacktrace={stackTrace} />
      </StackTraceWrapper>
    </Fragment>
  ) : (
    <NoContextWrapper>
      {t('There is no stack trace available for this event.')}
    </NoContextWrapper>
  );
}
const ErrorTitleContainer = styled(ContextContainer)`
  padding: ${space(1.5)};
`;

const ErrorTitleBody = styled(ContextBody)`
  margin: 0;
  max-width: 450px;
  ${p => p.theme.overflowEllipsis}
`;

const EventContextBody = styled(ContextBody)`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin: 0;
  align-items: flex-start;
  flex-direction: column;
`;

const EventContextContainer = styled(ContextContainer)`
  & + & {
    margin-top: ${space(2)};
  }
`;

const StackTraceWrapper = styled('div')`
  overflow: hidden;
  max-height: 300px;
  width: 500px;
  overflow-y: auto;
  .traceback {
    margin-bottom: 0;
    border: 0;
    box-shadow: none;
  }
  border-radius: ${p => p.theme.borderRadius};
`;

const HttpStatusWrapper = styled('span')`
  margin-left: ${space(0.5)};
`;

export default EventContext;
