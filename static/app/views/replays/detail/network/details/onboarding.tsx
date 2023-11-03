import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import ExternalLink from 'sentry/components/links/externalLink';
import TextCopyInput from 'sentry/components/textCopyInput';
import {IconClose, IconInfo} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SpanFrame} from 'sentry/utils/replays/types';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectSdkNeedsUpdate from 'sentry/utils/useProjectSdkNeedsUpdate';
import {Output} from 'sentry/views/replays/detail/network/details/getOutputType';
import type {TabKey} from 'sentry/views/replays/detail/network/details/tabs';

export const useDismissReqRespBodiesAlert = () => {
  const organization = useOrganization();
  return useDismissAlert({
    key: `${organization.id}:replay-network-bodies-alert-dismissed`,
  });
};

export function ReqRespBodiesAlert({
  isNetworkDetailsSetup,
}: {
  isNetworkDetailsSetup: boolean;
}) {
  const {dismiss, isDismissed} = useDismissReqRespBodiesAlert();

  if (isDismissed) {
    return null;
  }

  const message = isNetworkDetailsSetup
    ? tct(
        'Click on a [fetch] or [xhr] request to see request and response bodies. [link].',
        {
          fetch: <code>fetch</code>,
          xhr: <code>xhr</code>,
          link: (
            <ExternalLink
              href="https://docs.sentry.io/platforms/javascript/session-replay/configuration/#network-details"
              onClick={dismiss}
            >
              {t('Learn More')}
            </ExternalLink>
          ),
        }
      )
    : tct('Start collecting the body of requests and responses. [link].', {
        link: (
          <ExternalLink
            href="https://docs.sentry.io/platforms/javascript/session-replay/configuration/#network-details"
            onClick={dismiss}
          >
            {t('Learn More')}
          </ExternalLink>
        ),
      });
  return (
    <StyledAlert
      icon={<IconInfo />}
      opaque={false}
      showIcon
      type="info"
      trailingItems={
        <StyledButton priority="link" size="sm" onClick={dismiss}>
          <IconClose color="gray500" size="sm" />
        </StyledButton>
      }
    >
      {message}
    </StyledAlert>
  );
}

const StyledAlert = styled(Alert)`
  margin-bottom: ${space(1)};
`;

const StyledButton = styled(Button)`
  color: inherit;
`;

export function UnsupportedOp({type}: {type: 'headers' | 'bodies'}) {
  const title =
    type === 'bodies'
      ? t('Capture Request and Response Bodies')
      : t('Capture Request and Response Headers');

  return (
    <StyledInstructions data-test-id="network-op-unsupported">
      <h1>{title}</h1>
      <p>
        {tct(
          `This feature is only compatible with [fetch] and [xhr] request types. [link].`,
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
  const organization = useOrganization();
  const {isFetching, needsUpdate} = useProjectSdkNeedsUpdate({
    // Only show update instructions if not >= 7.50.0, but our instructions
    // will show a different min version as there are known bugs in 7.50 ->
    // 7.53
    minVersion: '7.50.0',
    organization,
    projectId: [projectId],
  });
  const sdkNeedsUpdate = !isFetching && Boolean(needsUpdate);

  const url = item.description || 'http://example.com';

  return (
    <SetupInstructions
      minVersion="7.53.1"
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
  if (showSnippet === Output.DATA && visibleTab === 'details') {
    return (
      <NoMarginAlert type="muted" system data-test-id="network-setup-steps">
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

  function trimUrl(oldUrl: string): string {
    const end = oldUrl.indexOf('?') > 0 ? oldUrl.indexOf('?') : oldUrl.length;
    return oldUrl.substring(0, end);
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
    new Replay({${urlSnippet + (includeHeadersSnippet ? headersSnippet : '')}
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
      <h1>{title}</h1>
      <p>
        {tct(
          `To protect user privacy, Session Replay defaults to not capturing the request or response headers. However, we provide the option to do so, if it’s critical to your debugging process. [link].`,
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/session-replay/configuration/#network-details">
                {t('Learn More')}
              </ExternalLink>
            ),
          }
        )}
      </p>
      <NetworkUrlWrapper>
        {showSnippet === Output.URL_SKIPPED &&
          url !== '[Filtered]' &&
          tct(
            'Add the following to your [field] list to start capturing data: [alert] ',
            {
              field: <code>networkDetailAllowUrls</code>,
              alert: <StyledTextCopyInput>{trimUrl(url)}</StyledTextCopyInput>,
            }
          )}
      </NetworkUrlWrapper>
      {showSnippet === Output.BODY_SKIPPED && (
        <Alert type="warning">
          {tct('Enable [field] to capture both Request and Response bodies.', {
            field: <code>networkCaptureBodies: true</code>,
          })}
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
      {url !== '[Filtered]' && (
        <CodeSnippet filename="JavaScript" language="javascript">
          {code}
        </CodeSnippet>
      )}
    </StyledInstructions>
  );
}

const StyledTextCopyInput = styled(TextCopyInput)`
  margin-top: ${space(0.5)};
`;

const NetworkUrlWrapper = styled('div')`
  margin: ${space(1)} ${space(0)} ${space(1.5)} ${space(0)};
`;

const NoMarginAlert = styled(Alert)`
  margin: 0;
  border-width: 1px 0 0 0;
`;

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
