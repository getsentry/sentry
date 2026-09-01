import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';

import {CodeBlock} from '@sentry/scraps/code';
import {DrawerBody, DrawerHeader, useDrawer} from '@sentry/scraps/drawer';
import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {DateTime} from 'sentry/components/dateTime';
import type {KeyValueDataContentProps} from 'sentry/components/keyValueData';
import {KeyValueData} from 'sentry/components/keyValueData';
import {JsonEventData} from 'sentry/components/structuredEventData/jsonEventData';
import {t} from 'sentry/locale';
import type {SentryAppWebhookRequest} from 'sentry/types/integrations';
import {shouldUse24Hours} from 'sentry/utils/dates';
import {decodeWebhookBody} from 'sentry/views/settings/organizationDeveloperSettings/sentryApplicationDashboard/decodeWebhookBody';
import {ResponseCode} from 'sentry/views/settings/organizationDeveloperSettings/sentryApplicationDashboard/requestLog';

const is24Hours = shouldUse24Hours();

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

function RequestLogDetails({request}: {request: SentryAppWebhookRequest}) {
  const {request_body, request_headers, response_body} = request;

  const summaryItems: KeyValueDataContentProps[] = [
    {
      item: {
        key: 'date',
        subject: t('Time'),
        value: (
          <DateTime
            date={request.date}
            format={is24Hours ? 'MMM D, YYYY HH:mm:ss z' : 'll LTS z'}
          />
        ),
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
    {
      item: {key: 'webhookUrl', subject: t('Webhook URL'), value: request.webhookUrl},
      disableFormattedData: true,
    },
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

export function useRequestLogDetailsDrawer() {
  const {openDrawer} = useDrawer();

  return useCallback(
    (request: SentryAppWebhookRequest) => {
      openDrawer(() => <RequestLogDetails request={request} />, {
        ariaLabel: t('Webhook request details'),
        drawerKey: 'sentry-app-webhook-request-details',
      });
    },
    [openDrawer]
  );
}

const BodyCardPanel = styled(KeyValueData.CardPanel)`
  display: block;

  pre {
    margin: 0;
  }
`;
