import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import memoize from 'lodash/memoize';

import {Tag, type TagProps} from '@sentry/scraps/badge';
import {Button, ButtonBar} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Switch} from '@sentry/scraps/switch';
import {Heading, Text} from '@sentry/scraps/text';

import {sentryAppWebhookRequestsApiOptions} from 'sentry/actionCreators/sentryApps';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {DateTime} from 'sentry/components/dateTime';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {PerformanceDuration} from 'sentry/components/performanceDuration';
import {StructuredEventData} from 'sentry/components/structuredEventData';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {
  SentryApp,
  SentryAppSchemaIssueLink,
  SentryAppWebhookRequest,
} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {shouldUse24Hours} from 'sentry/utils/dates';
import {defined} from 'sentry/utils/defined';
import {useOrganization} from 'sentry/utils/useOrganization';
import {granularWebhookEvents} from 'sentry/views/settings/organizationDeveloperSettings/constants';

import {WebhookSubject} from './webhookSubjects';

const ALL_EVENTS = t('All Events');
const MAX_PER_PAGE = 10;
const EMPTY_VALUE = '—';
const is24Hours = shouldUse24Hours();
const TIME_FORMAT = is24Hours ? 'MMM D, YYYY HH:mm:ss z' : 'll LTS z';

const NO_RESPONSE_STATUS_LABELS: Record<number, string> = {
  0: t('timeout'),
  [-1]: t('connection error'),
};

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
    ...(app.status === 'internal'
      ? []
      : ['installation.created', 'installation.deleted']),
    ...granularWebhookEvents(app.webhookEvents),
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
  let variant: TagProps['variant'] = 'danger';
  if (code <= 399 && code >= 300) {
    variant = 'warning';
  } else if (code <= 299 && code >= 100) {
    variant = 'success';
  }

  return <Tag variant={variant}>{NO_RESPONSE_STATUS_LABELS[code] ?? code}</Tag>;
}

function RequestBody({body}: {body: string}) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return <BodyText>{body}</BodyText>;
  }

  return <StructuredEventData data={parsed} maxDefaultDepth={1} />;
}

function DetailField({label, children}: {children: React.ReactNode; label: string}) {
  return (
    <Fragment>
      <Text variant="muted">{label}</Text>
      <Flex align="center" gap="sm" minWidth="0">
        {children}
      </Flex>
    </Fragment>
  );
}

function DetailSection({label, children}: {children: React.ReactNode; label: string}) {
  return (
    <Stack gap="xs">
      <Text variant="muted">{label}</Text>
      {children}
    </Stack>
  );
}

interface RequestLogDetailsProps {
  isInternal: boolean;
  organization: Organization;
  request: SentryAppWebhookRequest;
}

function RequestLogDetails({request, isInternal, organization}: RequestLogDetailsProps) {
  return (
    <Stack gap="xl" padding="md 0">
      <Grid columns="max-content minmax(0, 1fr)" gap="md xl" align="start">
        <DetailField label={t('Webhook URL')}>
          <Text wordBreak="break-word">{request.webhookUrl}</Text>
        </DetailField>
        <DetailField label={t('Event Type')}>
          <Text>{request.eventType}</Text>
        </DetailField>
        <DetailField label={t('Time')}>
          <Text>
            <DateTime date={request.date} format={TIME_FORMAT} />
          </Text>
        </DetailField>
        <DetailField label={t('Status Code')}>
          <ResponseCode code={request.responseCode} />
        </DetailField>
        {request.organization && (
          <DetailField label={t('Organization')}>
            <Text>{request.organization.name}</Text>
          </DetailField>
        )}
        <DetailField label={t('Duration')}>
          {defined(request.durationMs) ? (
            <PerformanceDuration milliseconds={request.durationMs} abbreviation />
          ) : (
            <Text>{EMPTY_VALUE}</Text>
          )}
        </DetailField>
        <DetailField label={t('Subject')}>
          <WebhookSubject
            subjectType={request.subjectType}
            subjectId={request.subjectId}
            isInternal={isInternal}
            organization={organization}
          />
        </DetailField>
        <DetailField label={t('Request ID')}>
          {defined(request.requestId) ? (
            <Fragment>
              <Text>{request.requestId}</Text>
              <CopyToClipboardButton
                variant="transparent"
                size="zero"
                text={request.requestId}
                aria-label={t('Copy Request ID')}
              />
            </Fragment>
          ) : (
            <Text>{EMPTY_VALUE}</Text>
          )}
        </DetailField>
        {defined(request.error_id) && (
          <DetailField label={t('Error ID')}>
            <Text>{request.error_id}</Text>
          </DetailField>
        )}
      </Grid>

      {defined(request.request_headers) && (
        <DetailSection label={t('Request Headers')}>
          <StructuredEventData data={request.request_headers} maxDefaultDepth={1} />
        </DetailSection>
      )}
      {defined(request.request_body) && (
        <DetailSection label={t('Request Body')}>
          <RequestBody body={request.request_body} />
        </DetailSection>
      )}
      {defined(request.response_body) && (
        <DetailSection label={t('Response Body')}>
          <RequestBody body={request.response_body} />
        </DetailSection>
      )}
    </Stack>
  );
}

interface RequestLogProps {
  app: SentryApp;
}

export function RequestLog({app}: RequestLogProps) {
  const organization = useOrganization();
  const [currentPage, setCurrentPage] = useState(0);
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [eventType, setEventType] = useState(ALL_EVENTS);
  const [expandedRows, setExpandedRows] = useState(() => new Set<number>());

  const {slug, status} = app;
  const isInternal = status === 'internal';

  const {
    data: requests = [],
    isPending,
    isError,
  } = useQuery(
    sentryAppWebhookRequestsApiOptions({
      appSlug: slug,
      eventType: eventType === ALL_EVENTS ? undefined : eventType,
      errorsOnly: errorsOnly || undefined,
    })
  );

  const currentRequests = useMemo(
    () => requests.slice(currentPage * MAX_PER_PAGE, (currentPage + 1) * MAX_PER_PAGE),
    [currentPage, requests]
  );

  const hasNextPage = (currentPage + 1) * MAX_PER_PAGE < requests.length;
  const hasPrevPage = currentPage > 0;

  const toggleRow = (rowKey: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        next.add(rowKey);
      }
      return next;
    });
  };

  const handleChangeEventType = (newEventType: string) => {
    setEventType(newEventType);
    setCurrentPage(0);
    setExpandedRows(new Set());
  };

  const handleChangeErrorsOnly = () => {
    setErrorsOnly(!errorsOnly);
    setCurrentPage(0);
    setExpandedRows(new Set());
  };

  return (
    <Stack gap="xl">
      <Stack gap="md">
        <Heading as="h5">{t('Request Log')}</Heading>

        <Text>
          {t(
            'This log shows the status of any outgoing webhook requests from Sentry to your integration.'
          )}
        </Text>

        <Flex align="center" gap="2xl">
          <CompactSelect
            trigger={triggerProps => (
              <OverlayTrigger.Button {...triggerProps}>{eventType}</OverlayTrigger.Button>
            )}
            value={eventType}
            options={getEventTypes(app).map(type => ({
              value: type,
              label: type,
            }))}
            onChange={opt => handleChangeEventType(opt?.value)}
          />

          <Flex as="label" align="center" gap="md" marginBottom="0">
            <Text>{t('Errors Only')}</Text>
            <Switch checked={errorsOnly} onChange={handleChangeErrorsOnly} />
          </Flex>
        </Flex>
      </Stack>

      {isError ? (
        <LoadingError />
      ) : (
        <RequestLogTable
          isInternal={isInternal}
          header={
            <SimpleTable.HeaderRow>
              <SimpleTable.HeaderCell />
              <SimpleTable.HeaderCell>{t('Time')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Status Code')}</SimpleTable.HeaderCell>
              {!isInternal && (
                <SimpleTable.HeaderCell>{t('Organization')}</SimpleTable.HeaderCell>
              )}
              <SimpleTable.HeaderCell>{t('Event Type')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Subject')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Duration')}</SimpleTable.HeaderCell>
            </SimpleTable.HeaderRow>
          }
        >
          {isPending && (
            <SimpleTable.Empty>
              <LoadingIndicator />
            </SimpleTable.Empty>
          )}

          {!isPending && currentRequests.length === 0 && (
            <SimpleTable.Empty>
              {t('No requests found in the last 30 days.')}
            </SimpleTable.Empty>
          )}

          {!isPending &&
            currentRequests.map((request, idx) => {
              const rowKey = currentPage * MAX_PER_PAGE + idx;
              const isExpanded = expandedRows.has(rowKey);
              return (
                <Fragment key={rowKey}>
                  <SimpleTable.Row data-test-id="request-item">
                    <InteractionStateLayer as="td" />
                    <SimpleTable.RowCell>
                      <ExpandToggle
                        aria-label={isExpanded ? t('Collapse row') : t('Expand row')}
                        aria-expanded={isExpanded}
                        onClick={() => toggleRow(rowKey)}
                      >
                        <IconChevron
                          direction={isExpanded ? 'down' : 'right'}
                          size="xs"
                        />
                      </ExpandToggle>
                    </SimpleTable.RowCell>
                    <SimpleTable.RowCell>
                      <Text>
                        <DateTime date={request.date} format={TIME_FORMAT} />
                      </Text>
                    </SimpleTable.RowCell>
                    <SimpleTable.RowCell>
                      <ResponseCode code={request.responseCode} />
                    </SimpleTable.RowCell>
                    {!isInternal && (
                      <SimpleTable.RowCell>
                        <Text ellipsis>{request.organization?.name}</Text>
                      </SimpleTable.RowCell>
                    )}
                    <SimpleTable.RowCell>
                      <Text ellipsis>{request.eventType}</Text>
                    </SimpleTable.RowCell>
                    <SimpleTable.RowCell>
                      <WebhookSubject
                        subjectType={request.subjectType}
                        subjectId={request.subjectId}
                        isInternal={isInternal}
                        organization={organization}
                        disableLink
                      />
                    </SimpleTable.RowCell>
                    <SimpleTable.RowCell>
                      {defined(request.durationMs) ? (
                        <PerformanceDuration
                          milliseconds={request.durationMs}
                          abbreviation
                        />
                      ) : (
                        <Text>{EMPTY_VALUE}</Text>
                      )}
                    </SimpleTable.RowCell>
                  </SimpleTable.Row>
                  {isExpanded && (
                    <SimpleTable.FullWidthRow>
                      <RequestLogDetails
                        request={request}
                        isInternal={isInternal}
                        organization={organization}
                      />
                    </SimpleTable.FullWidthRow>
                  )}
                </Fragment>
              );
            })}
        </RequestLogTable>
      )}

      <Flex justify="end">
        <ButtonBar>
          <Button
            icon={<IconChevron direction="left" />}
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={!hasPrevPage}
            aria-label={t('Previous page')}
          />
          <Button
            icon={<IconChevron direction="right" />}
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={!hasNextPage}
            aria-label={t('Next page')}
          />
        </ButtonBar>
      </Flex>
    </Stack>
  );
}

const RequestLogTable = styled(SimpleTable, {
  shouldForwardProp: prop => prop !== 'isInternal',
})<{isInternal: boolean}>`
  grid-template-columns: ${p =>
    p.isInternal ? 'auto 1fr 0.5fr 1fr 1fr 0.5fr' : 'auto 1fr 0.5fr 1fr 1fr 1fr 0.5fr'};
`;

const ExpandToggle = styled('button')`
  ${SimpleTable.rowLinkStyle}
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: ${p => p.theme.tokens.content.secondary};
`;

const BodyText = styled('pre')`
  margin: 0;
  padding: ${p => p.theme.space.md};
  max-height: 400px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: ${p => p.theme.font.size.sm};
  background: ${p => p.theme.tokens.background.secondary};
  border-radius: ${p => p.theme.radius.sm};
`;
