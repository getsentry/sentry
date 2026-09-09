import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';

import {CodeBlock} from '@sentry/scraps/code';
import {DrawerBody, DrawerHeader, useDrawer} from '@sentry/scraps/drawer';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {DateTime} from 'sentry/components/dateTime';
import type {KeyValueDataContentProps} from 'sentry/components/keyValueData';
import {KeyValueData} from 'sentry/components/keyValueData';
import {PerformanceDuration} from 'sentry/components/performanceDuration';
import {JsonEventData} from 'sentry/components/structuredEventData/jsonEventData';
import {t} from 'sentry/locale';
import type {SentryAppWebhookRequest} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {shouldUse24Hours} from 'sentry/utils/dates';
import {defined} from 'sentry/utils/defined';
import {decodeWebhookBody} from 'sentry/views/settings/organizationDeveloperSettings/sentryApplicationDashboard/decodeWebhookBody';
import {ResponseCode} from 'sentry/views/settings/organizationDeveloperSettings/sentryApplicationDashboard/requestLog';

import {WebhookSubject} from './webhookSubjects';

const EMPTY_VALUE = '—';

function BodySection({title, body}: {body: string; title: string}) {
  const {parsed, raw, maybeTruncated} = decodeWebhookBody(body);

  return (
    <BodyCardPanel>
      <KeyValueData.Title>
        {title}
        {maybeTruncated && (
          <Text variant="muted" size="xs">{` (${t('truncated')})`}</Text>
        )}
      </KeyValueData.Title>
      {parsed === null ? (
        <CodeBlock>{raw}</CodeBlock>
      ) : (
        <JsonEventData data={parsed} showCopyButton />
      )}
    </BodyCardPanel>
  );
}

interface RequestLogDetailsProps {
  isInternal: boolean;
  organization: Organization;
  request: SentryAppWebhookRequest;
}

function RequestLogDetails({request, isInternal, organization}: RequestLogDetailsProps) {
  const {request_body, request_headers, response_body} = request;
  const timeFormat = shouldUse24Hours() ? 'MMM D, YYYY HH:mm:ss z' : 'll LTS z';

  const summaryItems: KeyValueDataContentProps[] = [
    {
      item: {
        key: 'date',
        subject: t('Time'),
        value: <DateTime date={request.date} format={timeFormat} />,
      },
      disableFormattedData: true,
    },
    {
      item: {
        key: 'responseCode',
        subject: t('Status Code'),
        value: <ResponseCode code={request.responseCode} />,
      },
      disableFormattedData: true,
    },
    {
      item: {key: 'eventType', subject: t('Event Type'), value: request.eventType},
      disableFormattedData: true,
    },
    ...(request.organization
      ? [
          {
            item: {
              key: 'organization',
              subject: t('Organization'),
              value: request.organization.name,
            },
            disableFormattedData: true,
          },
        ]
      : []),
    {
      item: {
        key: 'subject',
        subject: t('Subject'),
        value: (
          <WebhookSubject
            subjectType={request.subjectType}
            subjectId={request.subjectId}
            isInternal={isInternal}
            organization={organization}
          />
        ),
      },
      disableFormattedData: true,
    },
    {
      item: {
        key: 'duration',
        subject: t('Duration'),
        value: defined(request.durationMs) ? (
          <PerformanceDuration milliseconds={request.durationMs} abbreviation />
        ) : (
          EMPTY_VALUE
        ),
      },
      disableFormattedData: true,
    },
    {
      item: {key: 'webhookUrl', subject: t('Webhook URL'), value: request.webhookUrl},
      disableFormattedData: true,
    },
    {
      item: {
        key: 'requestId',
        subject: t('Request ID'),
        value: defined(request.requestId) ? (
          <Flex align="center" gap="sm">
            <Text>{request.requestId}</Text>
            <CopyToClipboardButton
              variant="transparent"
              size="zero"
              text={request.requestId}
              aria-label={t('Copy Request ID')}
            />
          </Flex>
        ) : (
          EMPTY_VALUE
        ),
      },
      disableFormattedData: true,
    },
    ...(defined(request.error_id)
      ? [
          {
            item: {
              key: 'errorId',
              subject: t('Error ID'),
              value: request.error_id,
            },
            disableFormattedData: true,
          },
        ]
      : []),
  ];

  const headerItems: KeyValueDataContentProps[] = Object.entries(
    request_headers ?? {}
  ).map(([name, value]) => ({
    item: {key: name, subject: name, value},
    disableFormattedData: true,
  }));

  return (
    <Fragment>
      <DrawerHeader>
        <Heading as="h3" size="lg">
          {t('Webhook Request')}
        </Heading>
      </DrawerHeader>
      <DrawerBody>
        <Stack gap="xl">
          <KeyValueData.Card title={t('Summary')} contentItems={summaryItems} />

          {headerItems.length > 0 && (
            <KeyValueData.Card title={t('Request Headers')} contentItems={headerItems} />
          )}

          {request_body && <BodySection title={t('Request Body')} body={request_body} />}
          {response_body && (
            <BodySection title={t('Response Body')} body={response_body} />
          )}
        </Stack>
      </DrawerBody>
    </Fragment>
  );
}

interface UseRequestLogDetailsDrawerOptions {
  isInternal: boolean;
  organization: Organization;
}

export function useRequestLogDetailsDrawer({
  isInternal,
  organization,
}: UseRequestLogDetailsDrawerOptions) {
  const {openDrawer} = useDrawer();

  return useCallback(
    (request: SentryAppWebhookRequest) => {
      openDrawer(
        () => (
          <RequestLogDetails
            request={request}
            isInternal={isInternal}
            organization={organization}
          />
        ),
        {
          ariaLabel: t('Webhook request details'),
          drawerKey: 'sentry-app-webhook-request-details',
        }
      );
    },
    [isInternal, openDrawer, organization]
  );
}

const BodyCardPanel = styled(KeyValueData.CardPanel)`
  display: block;

  pre {
    margin: 0;
  }
`;
