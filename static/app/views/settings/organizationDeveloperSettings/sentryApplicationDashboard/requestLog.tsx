import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import memoize from 'lodash/memoize';
import type moment from 'moment-timezone';

import Tag from 'sentry/components/badge/tag';
import {Button, StyledButton} from 'sentry/components/button';
import Checkbox from 'sentry/components/checkbox';
import {CompactSelect} from 'sentry/components/compactSelect';
import {DateTime} from 'sentry/components/dateTime';
import EmptyMessage from 'sentry/components/emptyMessage';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import {IconChevron, IconFlag, IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {
  SentryApp,
  SentryAppSchemaIssueLink,
  SentryAppWebhookRequest,
} from 'sentry/types/integrations';
import {shouldUse24Hours} from 'sentry/utils/dates';
import {type ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';

const ALL_EVENTS = t('All Events');
const MAX_PER_PAGE = 10;
const is24Hours = shouldUse24Hours();

const componentHasSelectUri = (issueLinkComponent: SentryAppSchemaIssueLink): boolean => {
  const hasSelectUri = (fields: any[]): boolean =>
    fields.some(field => field.type === 'select' && 'uri' in field);

  const createHasSelectUri =
    hasSelectUri(issueLinkComponent.create.required_fields) ||
    hasSelectUri(issueLinkComponent.create.optional_fields || []);

  const linkHasSelectUri =
    hasSelectUri(issueLinkComponent.link.required_fields) ||
    hasSelectUri(issueLinkComponent.link.optional_fields || []);

  return createHasSelectUri || linkHasSelectUri;
};

const getEventTypes = memoize((app: SentryApp) => {
  // TODO(nola): ideally this would be kept in sync with EXTENDED_VALID_EVENTS on the backend

  let issueLinkEvents: string[] = [];
  const issueLinkComponent = (app.schema.elements || []).find(
    element => element.type === 'issue-link'
  );
  if (issueLinkComponent) {
    issueLinkEvents = ['external_issue.created', 'external_issue.linked'];
    if (componentHasSelectUri(issueLinkComponent)) {
      issueLinkEvents.push('select_options.requested');
    }
  }

  const events = [
    ALL_EVENTS,
    // Internal apps don't have installation webhooks
    ...(app.status !== 'internal'
      ? ['installation.created', 'installation.deleted']
      : []),
    ...(app.events.includes('error') ? ['error.created'] : []),
    ...(app.events.includes('issue')
      ? ['issue.created', 'issue.resolved', 'issue.ignored', 'issue.assigned']
      : []),
    ...(app.isAlertable
      ? [
          'event_alert.triggered',
          'metric_alert.open',
          'metric_alert.resolved',
          'metric_alert.critical',
          'metric_alert.warning',
        ]
      : []),
    ...issueLinkEvents,
  ];

  return events;
});

function ResponseCode({code}: {code: number}) {
  let type: React.ComponentProps<typeof Tag>['type'] = 'error';
  if (code <= 399 && code >= 300) {
    type = 'warning';
  } else if (code <= 299 && code >= 100) {
    type = 'success';
  }

  return (
    <Tags>
      <StyledTag type={type}>{code === 0 ? 'timeout' : code}</StyledTag>
    </Tags>
  );
}

function TimestampLink({date, link}: {date: moment.MomentInput; link?: string}) {
  return link ? (
    <ExternalLink href={link}>
      <DateTime date={date} />
      <StyledIconOpen size="xs" />
    </ExternalLink>
  ) : (
    <DateTime date={date} format={is24Hours ? 'MMM D, YYYY HH:mm:ss z' : 'll LTS z'} />
  );
}

interface RequestLogProps {
  app: SentryApp;
}

function makeRequestLogQueryKey(slug: string): ApiQueryKey {
  return [`/sentry-apps/${slug}/requests/`];
}

export default function RequestLog({app}: RequestLogProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [eventType, setEventType] = useState(ALL_EVENTS);

  const {slug} = app;

  const query: any = {};
  if (eventType !== ALL_EVENTS) {
    query.eventType = eventType;
  }
  if (errorsOnly) {
    query.errorsOnly = true;
  }

  const {
    data: requests = [],
    isLoading,
    refetch,
  } = useApiQuery<SentryAppWebhookRequest[]>(makeRequestLogQueryKey(slug), query);

  const currentRequests = useMemo(
    () => requests.slice(currentPage * MAX_PER_PAGE, (currentPage + 1) * MAX_PER_PAGE),
    [currentPage, requests]
  );

  const hasNextPage = useMemo(
    () => (currentPage + 1) * MAX_PER_PAGE < requests.length,
    [currentPage, requests]
  );

  const hasPrevPage = useMemo(() => currentPage > 0, [currentPage]);

  const handleChangeEventType = useCallback(
    (newEventType: string) => {
      setEventType(newEventType);
      setCurrentPage(0);
      refetch();
    },
    [refetch]
  );

  const handleChangeErrorsOnly = useCallback(() => {
    setErrorsOnly(!errorsOnly);
    setCurrentPage(0);
    refetch();
  }, [errorsOnly, refetch]);

  const handleNextPage = useCallback(() => {
    setCurrentPage(currentPage + 1);
    refetch();
  }, [currentPage, refetch]);

  const handlePrevPage = useCallback(() => {
    setCurrentPage(currentPage - 1);
    refetch();
  }, [currentPage, refetch]);

  return (
    <Fragment>
      <h5>{t('Request Log')}</h5>

      <div>
        <p>
          {t(
            'This log shows the status of any outgoing webhook requests from Sentry to your integration.'
          )}
        </p>

        <RequestLogFilters>
          <CompactSelect
            triggerLabel={eventType}
            value={eventType}
            options={getEventTypes(app).map(type => ({
              value: type,
              label: type,
            }))}
            onChange={opt => handleChangeEventType(opt?.value)}
          />

          <StyledErrorsOnlyButton onClick={handleChangeErrorsOnly}>
            <ErrorsOnlyCheckbox>
              <Checkbox checked={errorsOnly} onChange={() => {}} />
              {t('Errors Only')}
            </ErrorsOnlyCheckbox>
          </StyledErrorsOnlyButton>
        </RequestLogFilters>
      </div>

      <Panel>
        <PanelHeader>
          <TableLayout hasOrganization={app.status !== 'internal'}>
            <div>{t('Time')}</div>
            <div>{t('Status Code')}</div>
            {app.status !== 'internal' && <div>{t('Organization')}</div>}
            <div>{t('Event Type')}</div>
            <div>{t('Webhook URL')}</div>
          </TableLayout>
        </PanelHeader>

        {!isLoading ? (
          <PanelBody>
            {currentRequests.length > 0 ? (
              currentRequests.map((request, idx) => (
                <PanelItem key={idx} data-test-id="request-item">
                  <TableLayout hasOrganization={app.status !== 'internal'}>
                    <TimestampLink date={request.date} link={request.errorUrl} />
                    <ResponseCode code={request.responseCode} />
                    {app.status !== 'internal' && (
                      <div>{request.organization ? request.organization.name : null}</div>
                    )}
                    <div>{request.eventType}</div>
                    <OverflowBox>{request.webhookUrl}</OverflowBox>
                  </TableLayout>
                </PanelItem>
              ))
            ) : (
              <EmptyMessage icon={<IconFlag size="xl" />}>
                {t('No requests found in the last 30 days.')}
              </EmptyMessage>
            )}
          </PanelBody>
        ) : (
          <LoadingIndicator />
        )}
      </Panel>

      <PaginationButtons>
        <Button
          icon={<IconChevron direction="left" />}
          onClick={handlePrevPage}
          disabled={!hasPrevPage}
          aria-label={t('Previous page')}
        />
        <Button
          icon={<IconChevron direction="right" />}
          onClick={handleNextPage}
          disabled={!hasNextPage}
          aria-label={t('Next page')}
        />
      </PaginationButtons>
    </Fragment>
  );
}

const TableLayout = styled('div')<{hasOrganization: boolean}>`
  display: grid;
  grid-template-columns: 1fr 0.5fr ${p => (p.hasOrganization ? '1fr' : '')} 1fr 1fr;
  grid-column-gap: ${space(1.5)};
  width: 100%;
  align-items: center;
`;

const OverflowBox = styled('div')`
  word-break: break-word;
`;

const PaginationButtons = styled('div')`
  display: flex;
  justify-content: flex-end;
  align-items: center;

  > :first-child {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  > :nth-child(2) {
    margin-left: -1px;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
`;

const RequestLogFilters = styled('div')`
  display: flex;
  align-items: center;
  padding-bottom: ${space(1)};

  > :first-child ${StyledButton} {
    border-radius: ${p => p.theme.borderRadius} 0 0 ${p => p.theme.borderRadius};
  }
`;

const ErrorsOnlyCheckbox = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const StyledErrorsOnlyButton = styled(Button)`
  margin-left: -1px;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
`;

const StyledIconOpen = styled(IconOpen)`
  margin-left: 6px;
  color: ${p => p.theme.subText};
`;

const Tags = styled('div')`
  margin: -${space(0.5)};
`;

const StyledTag = styled(Tag)`
  padding: ${space(0.5)};
  display: inline-flex;
`;
