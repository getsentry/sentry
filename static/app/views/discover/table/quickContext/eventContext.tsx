import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {
  getStacktrace,
  StackTracePreviewContent,
} from 'sentry/components/groupPreviewTooltip/stackTracePreview';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event, Project} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import {getDuration} from 'sentry/utils/formatters';
import {useApiQuery} from 'sentry/utils/queryClient';
import {
  getStatusBodyText,
  HttpStatus,
} from 'sentry/views/performance/transactionDetails/eventMetas';

import ActionDropDown, {ContextValueType} from './actionDropdown';
import {NoContext} from './quickContextWrapper';
import {
  ContextBody,
  ContextContainer,
  ContextHeader,
  ContextRow,
  ContextTitle,
  NoContextWrapper,
  Wrapper,
} from './styles';
import {BaseContextProps, ContextType, tenSecondInMs} from './utils';

interface EventContextProps extends BaseContextProps {
  eventView?: EventView;
  location?: Location;
  projects?: Project[];
}

function EventContext(props: EventContextProps) {
  const {organization, dataRow, eventView, location} = props;
  const {isLoading, isError, data} = useApiQuery<Event>(
    [
      `/organizations/${organization.slug}/events/${dataRow['project.name']}:${dataRow.id}/`,
    ],
    {
      staleTime: tenSecondInMs,
    }
  );

  useEffect(() => {
    if (data) {
      trackAnalytics('discover_v2.quick_context_hover_contexts', {
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
    const transactionDuration = getDuration(
      data.endTimestamp - data.startTimestamp,
      2,
      true
    );
    const status = getStatusBodyText(data);
    return (
      <Wrapper data-test-id="quick-context-hover-body">
        <EventContextContainer>
          <ContextHeader>
            <ContextTitle>{t('Transaction Duration')}</ContextTitle>
            {location && eventView && (
              <ActionDropDown
                dataRow={dataRow}
                contextValueType={ContextValueType.DURATION}
                location={location}
                eventView={eventView}
                organization={organization}
                queryKey="transaction.duration"
                value={transactionDuration}
              />
            )}
          </ContextHeader>
          <EventContextBody>{transactionDuration}</EventContextBody>
        </EventContextContainer>
        {location && (
          <EventContextContainer>
            <Fragment>
              <ContextHeader>
                <ContextTitle>{t('Status')}</ContextTitle>
                {location && eventView && (
                  <ActionDropDown
                    dataRow={dataRow}
                    contextValueType={ContextValueType.STRING}
                    location={location}
                    eventView={eventView}
                    organization={organization}
                    queryKey="transaction.status"
                    value={status}
                  />
                )}
              </ContextHeader>
              <EventContextBody>
                <ContextRow>
                  {status}
                  <HttpStatusWrapper>
                    (<HttpStatus event={data} />)
                  </HttpStatusWrapper>
                </ContextRow>
              </EventContextBody>
            </Fragment>
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
            <ContextTitle>{t('Title')}</ContextTitle>
            {location && eventView && (
              <ActionDropDown
                dataRow={dataRow}
                contextValueType={ContextValueType.STRING}
                location={location}
                eventView={eventView}
                organization={organization}
                queryKey="title"
                value={data.title}
              />
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
  }
  border-radius: ${p => p.theme.borderRadius};
`;

const HttpStatusWrapper = styled('span')`
  margin-left: ${space(0.5)};
`;

export default EventContext;
