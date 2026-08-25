import {useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import memoize from 'lodash/memoize';

import {Tag, type TagProps} from '@sentry/scraps/badge';
import {Button, ButtonBar} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Switch} from '@sentry/scraps/switch';
import {Heading, Text} from '@sentry/scraps/text';

import {sentryAppWebhookRequestsApiOptions} from 'sentry/actionCreators/sentryApps';
import {DateTime} from 'sentry/components/dateTime';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {SentryApp, SentryAppSchemaIssueLink} from 'sentry/types/integrations';
import {shouldUse24Hours} from 'sentry/utils/dates';
import {granularWebhookEvents} from 'sentry/views/settings/organizationDeveloperSettings/constants';

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

  return <Tag variant={variant}>{code === 0 ? 'timeout' : code}</Tag>;
}

interface RequestLogProps {
  app: SentryApp;
}

export function RequestLog({app}: RequestLogProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [eventType, setEventType] = useState(ALL_EVENTS);

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

  const handleChangeEventType = (newEventType: string) => {
    setEventType(newEventType);
    setCurrentPage(0);
  };

  const handleChangeErrorsOnly = () => {
    setErrorsOnly(!errorsOnly);
    setCurrentPage(0);
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
              <SimpleTable.HeaderCell>{t('Time')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Status Code')}</SimpleTable.HeaderCell>
              {!isInternal && (
                <SimpleTable.HeaderCell>{t('Organization')}</SimpleTable.HeaderCell>
              )}
              <SimpleTable.HeaderCell>{t('Event Type')}</SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Webhook URL')}</SimpleTable.HeaderCell>
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
            currentRequests.map((request, idx) => (
              <SimpleTable.Row key={idx} data-test-id="request-item">
                <SimpleTable.RowCell>
                  <Text>
                    <DateTime
                      date={request.date}
                      format={is24Hours ? 'MMM D, YYYY HH:mm:ss z' : 'll LTS z'}
                    />
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
                  <Text wordBreak="break-word">{request.webhookUrl}</Text>
                </SimpleTable.RowCell>
              </SimpleTable.Row>
            ))}
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
    p.isInternal ? '1fr 0.5fr 1fr 1fr' : '1fr 0.5fr 1fr 1fr 1fr'};
`;
