import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {CodeBlock} from '@sentry/scraps/code';
import {Container} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {TextCopyInput} from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import {
  MIN_REPLAY_NETWORK_BODIES_SDK,
  MIN_REPLAY_NETWORK_BODIES_SDK_KNOWN_BUG,
} from 'sentry/utils/replays/sdkVersions';
import type {SpanFrame} from 'sentry/utils/replays/types';
import {useDismissAlert} from 'sentry/utils/useDismissAlert';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectSdkNeedsUpdate} from 'sentry/utils/useProjectSdkNeedsUpdate';
import {Output} from 'sentry/views/explore/replays/detail/network/details/output';
import type {TabKey} from 'sentry/views/explore/replays/detail/network/details/tabs';

export const useDismissReqRespBodiesAlert = () => {
  const organization = useOrganization();
  return useDismissAlert({
    key: `${organization.id}:replay-network-bodies-alert-dismissed`,
  });
};

export function UnsupportedOp({type}: {type: 'headers' | 'bodies'}) {
  const title =
    type === 'bodies'
      ? t('Capture Request and Response Bodies')
      : t('Capture Request and Response Headers');

  return (
    <StyledInstructions data-test-id="network-op-unsupported">
      <h2>{title}</h2>
      <p>
        {tct(
          'This feature is only compatible with [fetch] and [xhr] request types. [link].',
          {
            fetch: <code>fetch</code>,
            xhr: <code>xhr</code>,
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/session-replay/configuration/#network-details">
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
  item: SpanFrame;
  projectId: string;
  showSnippet: Output;
  visibleTab: TabKey;
}) {
  const {isFetching, needsUpdate} = useProjectSdkNeedsUpdate({
    // Only show update instructions if <7.50.0, but our instructions
    // will show a different min version as there are known bugs in 7.50 ->
    // 7.53
    minVersion: MIN_REPLAY_NETWORK_BODIES_SDK_KNOWN_BUG.minVersion,
    projectId: [projectId],
  });
  const sdkNeedsUpdate = !isFetching && Boolean(needsUpdate);
  const replay = useReplayReader();
  const isVideoReplay = replay?.isVideoReplay();

  const url = item.description || 'http://example.com';

  if (isVideoReplay) {
    const sdkName = replay?.getReplay()?.sdk?.name;
    const docsUrl = getNetworkDetailsDocsUrl(sdkName);
    if (!docsUrl) {
      return visibleTab === 'request' || visibleTab === 'response' ? (
        <StyledAlert variant="info">
          {tct(
            'Request and response headers or bodies are currently not available for this platform. Track this [link:GitHub issue] to get progress on support for this feature.',
            {
              link: (
                <ExternalLink href="https://github.com/getsentry/sentry/issues/84596" />
              ),
            }
          )}
        </StyledAlert>
      ) : null;
    }
    return (
      <MobileSetupInstructions
        docsUrl={docsUrl}
        sdkName={sdkName}
        showSnippet={showSnippet}
        url={url}
        visibleTab={visibleTab}
      />
    );
  }

  return (
    <SetupInstructions
      minVersion={MIN_REPLAY_NETWORK_BODIES_SDK.minVersion}
      sdkNeedsUpdate={sdkNeedsUpdate}
      showSnippet={showSnippet}
      url={url}
      visibleTab={visibleTab}
    />
  );
}

function getNetworkDetailsDocsUrl(sdkName: string | null | undefined): string | null {
  switch (sdkName) {
    case 'sentry.java.android':
      return 'https://docs.sentry.io/platforms/android/session-replay/configuration/#network-details';
    case 'sentry.cocoa':
      return 'https://docs.sentry.io/platforms/apple/guides/ios/session-replay/configuration/#network-details';
    case 'npm:@sentry/react-native':
    case 'sentry.cocoa.react-native':
    case 'sentry.javascript.react-native':
    case 'sentry.java.android.react-native':
      return 'https://docs.sentry.io/platforms/react-native/session-replay/#network-details';
    default:
      return null;
  }
}

function getMobileCodeSnippet(
  sdkName: string | null | undefined,
  url: string,
  includeHeaders: boolean
): {code: string; filename: string; language: string} | null {
  const kotlinHeaders = includeHeaders
    ? [
        '    options.sessionReplay.networkRequestHeaders = listOf("X-Custom-Header")',
        '    options.sessionReplay.networkResponseHeaders = listOf("X-Custom-Header")',
      ]
    : [];
  const swiftHeaders = includeHeaders
    ? [
        '    options.sessionReplay.networkRequestHeaders = ["X-Custom-Header"]',
        '    options.sessionReplay.networkResponseHeaders = ["X-Custom-Header"]',
      ]
    : [];
  const jsHeaders = includeHeaders
    ? [
        "      networkRequestHeaders: ['X-Custom-Header'],",
        "      networkResponseHeaders: ['X-Custom-Header'],",
      ]
    : [];

  switch (sdkName) {
    case 'sentry.java.android':
      return {
        language: 'kotlin',
        filename: 'Kotlin',
        code: [
          'SentryAndroid.init(this) { options ->',
          `    options.sessionReplay.networkDetailAllowUrls = listOf("${url}")`,
          ...kotlinHeaders,
          '}',
        ].join('\n'),
      };
    case 'sentry.cocoa':
      return {
        language: 'swift',
        filename: 'Swift',
        code: [
          'SentrySDK.start { options in',
          '    options.experimental.enableReplayNetworkDetailsCapturing = true',
          `    options.sessionReplay.networkDetailAllowUrls = ["${url}"]`,
          ...swiftHeaders,
          '}',
        ].join('\n'),
      };
    case 'npm:@sentry/react-native':
    case 'sentry.cocoa.react-native':
    case 'sentry.javascript.react-native':
    case 'sentry.java.android.react-native':
      return {
        language: 'javascript',
        filename: 'JavaScript',
        code: [
          'Sentry.init({',
          '  integrations: [',
          '    Sentry.mobileReplayIntegration({',
          `      networkDetailAllowUrls: ['${url}'],`,
          ...jsHeaders,
          '    }),',
          '  ],',
          '})',
        ].join('\n'),
      };
    default:
      return null;
  }
}

function MobileSetupInstructions({
  docsUrl,
  sdkName,
  showSnippet,
  url,
  visibleTab,
}: {
  docsUrl: string;
  sdkName: string | null | undefined;
  showSnippet: Output;
  url: string;
  visibleTab: TabKey;
}) {
  if (showSnippet === Output.DATA && visibleTab === 'details') {
    return (
      <NoMarginAlert variant="muted" system data-test-id="network-setup-steps">
        {tct(
          'You can capture additional headers by adding them to the [requestConfig] and [responseConfig] lists in your SDK config. [link].',
          {
            requestConfig: <code>networkRequestHeaders</code>,
            responseConfig: <code>networkResponseHeaders</code>,
            link: <ExternalLink href={docsUrl}>{t('Learn More')}</ExternalLink>,
          }
        )}
      </NoMarginAlert>
    );
  }

  const trimmedUrl = trimUrl(url);

  const title =
    showSnippet === Output.SETUP
      ? t('Capture Request and Response Headers and Bodies')
      : visibleTab === 'details'
        ? t('Capture Request and Response Headers')
        : t('Capture Request and Response Bodies');

  const includeHeaders =
    showSnippet === Output.SETUP ||
    ([Output.URL_SKIPPED, Output.DATA].includes(showSnippet) && visibleTab === 'details');
  const snippet =
    url === '[Filtered]'
      ? null
      : getMobileCodeSnippet(sdkName, trimmedUrl, includeHeaders);

  return (
    <StyledInstructions data-test-id="network-setup-steps">
      <h2>{title}</h2>
      <p>
        {tct(
          'To protect user privacy, Session Replay defaults to not capturing the request or response headers. However, we provide the option to do so, if it’s critical to your debugging process. [link].',
          {
            link: <ExternalLink href={docsUrl}>{t('Learn More')}</ExternalLink>,
          }
        )}
      </p>
      {(showSnippet === Output.SETUP || showSnippet === Output.URL_SKIPPED) &&
        url !== '[Filtered]' && (
          <Container margin="md 0 lg 0">
            {tct(
              'Add the following to your [field] list to start capturing data: [alert] ',
              {
                field: <code>networkDetailAllowUrls</code>,
                alert: <StyledTextCopyInput>{trimmedUrl}</StyledTextCopyInput>,
              }
            )}
          </Container>
        )}
      {showSnippet === Output.BODY_SKIPPED && (
        <Alert.Container>
          <Alert variant="warning" showIcon={false}>
            {tct('Enable [field] to capture both Request and Response bodies.', {
              field: <code>networkCaptureBodies: true</code>,
            })}
          </Alert>
        </Alert.Container>
      )}
      {snippet && (
        <CodeBlock filename={snippet.filename} language={snippet.language}>
          {snippet.code}
        </CodeBlock>
      )}
    </StyledInstructions>
  );
}

function trimUrl(oldUrl: string): string {
  const end = oldUrl.indexOf('?') > 0 ? oldUrl.indexOf('?') : oldUrl.length;
  return oldUrl.substring(0, end);
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
  if (showSnippet === Output.DATA && visibleTab === 'details') {
    return (
      <NoMarginAlert variant="muted" system data-test-id="network-setup-steps">
        {tct(
          'You can capture additional headers by adding them to the [requestConfig] and [responseConfig] lists in your SDK config.',
          {
            requestConfig: <code>networkRequestHeaders</code>,
            responseConfig: <code>networkResponseHeaders</code>,
          }
        )}
      </NoMarginAlert>
    );
  }

  const urlSnippet = `
      networkDetailAllowUrls: ['${trimUrl(url)}'],`;
  const headersSnippet = `
      networkRequestHeaders: ['X-Custom-Header'],
      networkResponseHeaders: ['X-Custom-Header'],`;

  const includeHeadersSnippet =
    showSnippet === Output.SETUP ||
    ([Output.URL_SKIPPED, Output.DATA].includes(showSnippet) && visibleTab === 'details');

  const code = `Sentry.init({
  integrations: [
    Sentry.replayIntegration({${urlSnippet + (includeHeadersSnippet ? headersSnippet : '')}
    }),
  ],
})`;

  const title =
    showSnippet === Output.SETUP
      ? t('Capture Request and Response Headers and Bodies')
      : visibleTab === 'details'
        ? t('Capture Request and Response Headers')
        : t('Capture Request and Response Bodies');

  return (
    <StyledInstructions data-test-id="network-setup-steps">
      <h2>{title}</h2>
      <p>
        {tct(
          'To protect user privacy, Session Replay defaults to not capturing the request or response headers. However, we provide the option to do so, if it’s critical to your debugging process. [link].',
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/session-replay/configuration/#network-details">
                {t('Learn More')}
              </ExternalLink>
            ),
          }
        )}
      </p>
      <Container margin="md 0 lg 0">
        {showSnippet === Output.URL_SKIPPED &&
          url !== '[Filtered]' &&
          tct(
            'Add the following to your [field] list to start capturing data: [alert] ',
            {
              field: <code>networkDetailAllowUrls</code>,
              alert: <StyledTextCopyInput>{trimUrl(url)}</StyledTextCopyInput>,
            }
          )}
      </Container>
      {showSnippet === Output.BODY_SKIPPED && (
        <Alert.Container>
          <Alert variant="warning" showIcon={false}>
            {tct('Enable [field] to capture both Request and Response bodies.', {
              field: <code>networkCaptureBodies: true</code>,
            })}
          </Alert>
        </Alert.Container>
      )}
      <h2>{t('Prerequisites')}</h2>
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
      {url !== '[Filtered]' && (
        <CodeBlock filename="JavaScript" language="javascript">
          {code}
        </CodeBlock>
      )}
    </StyledInstructions>
  );
}

const StyledTextCopyInput = styled(TextCopyInput)`
  margin-top: ${p => p.theme.space.xs};
`;

const NoMarginAlert = styled(Alert)`
  border-width: 1px 0 0 0;
`;

const StyledInstructions = styled('div')`
  font-size: ${p => p.theme.font.size.sm};

  margin-top: ${p => p.theme.space.md};
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  padding: ${p => p.theme.space.xl};
  &:first-child {
    margin-top: 0;
    border-top: none;
  }

  h2 {
    font-size: inherit;
    margin-bottom: ${p => p.theme.space.md};
  }

  p {
    margin-bottom: ${p => p.theme.space.xl};
  }
  p:last-child {
    margin-bottom: 0;
  }
`;

const StyledAlert = styled(Alert)`
  margin: ${p => p.theme.space.md};
`;
