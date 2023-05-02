import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectSdkNeedsUpdate from 'sentry/utils/useProjectSdkNeedsUpdate';
import {Output} from 'sentry/views/replays/detail/network/details/getOutputType';
import type {TabKey} from 'sentry/views/replays/detail/network/details/tabs';
import type {NetworkSpan} from 'sentry/views/replays/types';

export function UnsupportedOp({type}: {type: 'headers' | 'bodies'}) {
  const title =
    type === 'bodies'
      ? t('Capture Request and Response Payloads')
      : t('Capture Request and Response Headers');

  return (
    <StyledInstructions data-test-id="network-op-unsupported">
      <h1>{title}</h1>
      <p>
        {tct(
          `This feature is only compatible with [fetch] and [xhr] request types. [link]`,
          {
            fetch: <code>fetch</code>,
            xhr: <code>xhr</code>,
            link: (
              <ExternalLink href="https://github.com/getsentry/sentry-javascript/issues/7103">
                {t('Learn more')}
              </ExternalLink>
            ),
          }
        )}
      </p>
    </StyledInstructions>
  );
}

export function Setup({
  item,
  projectId,
  showSnippet,
  visibleTab,
}: {
  item: NetworkSpan;
  projectId: string;
  showSnippet: Output;
  visibleTab: TabKey;
}) {
  const minVersion = '7.50.0';

  const organization = useOrganization();
  const {isFetching, needsUpdate} = useProjectSdkNeedsUpdate({
    minVersion,
    organization,
    projectId,
  });
  const sdkNeedsUpdate = !isFetching && needsUpdate;

  const url = item.description || 'http://example.com';

  return (
    <SetupInstructions
      minVersion={minVersion}
      sdkNeedsUpdate={sdkNeedsUpdate}
      showSnippet={showSnippet}
      url={url}
      visibleTab={visibleTab}
    />
  );
}

function SetupInstructions({
  minVersion,
  sdkNeedsUpdate,
  showSnippet,
  url,
  visibleTab,
}: {
  minVersion: string;
  sdkNeedsUpdate: boolean;
  showSnippet: Output;
  url: string;
  visibleTab: TabKey;
}) {
  const urlSnippet = `
      networkDetailAllowUrls: ['${url}'],`;
  const bodiesSnippet = `
      networkCaptureBodies: true,`;
  const headersSnippet = `
      networkRequestHeaders: ['X-Custom-Header'],
      networkResponseHeaders: ['X-Custom-Header'],`;

  const includeHeadersSnippet =
    showSnippet === Output.setup ||
    ([Output.urlSkipped, Output.data].includes(showSnippet) && visibleTab === 'details');
  const includeBodiesSnippet =
    [Output.setup, Output.bodySkipped].includes(showSnippet) ||
    (showSnippet === Output.urlSkipped && visibleTab !== 'details');

  const code = `Sentry.init({
  integrations: [
    new Replay({${
      urlSnippet +
      (includeBodiesSnippet ? bodiesSnippet : '') +
      (includeHeadersSnippet ? headersSnippet : '')
    }
    }),
  ],
})`;

  const title =
    showSnippet === Output.setup
      ? t('Capture Request and Response Headers and Payloads')
      : visibleTab === 'details'
      ? t('Capture Request and Response Headers')
      : t('Capture Request and Response Payloads');
  return (
    <StyledInstructions data-test-id="network-setup-steps">
      <h1>{title}</h1>
      <p>
        {tct(
          `To protect user privacy, Session Replay defaults to not capturing the request or response headers. However, we provide the option to do so, if it’s critical to your debugging process. [link]`,
          {
            link: (
              <ExternalLink href="https://github.com/getsentry/sentry-javascript/issues/7103">
                {t('Learn More')}
              </ExternalLink>
            ),
          }
        )}
      </p>

      {showSnippet === Output.urlSkipped && (
        <Alert type="warning">
          Add <kbd>{url}</kbd> to your <kbd>networkDetailAllowUrls</kbd> list to start
          capturing data.
        </Alert>
      )}

      {showSnippet === Output.bodySkipped && (
        <Alert type="warning">
          Enable <kbd>networkCaptureBodies: true</kbd> to capture both Request and
          Response payloads.
        </Alert>
      )}

      <h1>{t('Prerequisites')}</h1>
      <ol>
        {sdkNeedsUpdate ? (
          <li>
            {tct('Update your SDK version to >= [minVersion]', {
              minVersion,
            })}
          </li>
        ) : null}
        <li>{t('Edit the Replay integration configuration to allow this URL.')}</li>
        <li>{t('That’s it!')}</li>
      </ol>
      <CodeSnippet filename="JavaScript" language="javascript">
        {code}
      </CodeSnippet>
    </StyledInstructions>
  );
}

const StyledInstructions = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};

  margin-top: ${space(1)};
  border-top: 1px solid ${p => p.theme.border};
  padding: ${space(2)};
  &:first-child {
    margin-top: 0;
    border-top: none;
  }

  h1 {
    font-size: inherit;
    margin-bottom: ${space(1)};
  }

  p {
    margin-bottom: ${space(2)};
  }
  p:last-child {
    margin-bottom: 0;
  }
`;
