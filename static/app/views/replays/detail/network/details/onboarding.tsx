import {ComponentProps} from 'react';
import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectSdkNeedsUpdate from 'sentry/utils/useProjectSdkNeedsUpdate';
import type {NetworkSpan} from 'sentry/views/replays/types';

export function UnsupportedOp({type}: {type: 'headers' | 'bodies'}) {
  const title =
    type === 'bodies'
      ? t('Capture Request and Response Payloads')
      : t('Capture Request and Response Headers');

  return (
    <StyledInstructions>
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
}: {
  item: NetworkSpan;
  projectId: string;
  showSnippet: ComponentProps<typeof SetupInstructions>['showSnippet'];
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
    />
  );
}

function SetupInstructions({
  minVersion,
  sdkNeedsUpdate,
  showSnippet,
  url,
}: {
  minVersion: string;
  sdkNeedsUpdate: boolean;
  showSnippet: 'headers' | 'bodies' | 'both';
  url: string;
}) {
  const urlSnippet = `
      networkDetailAllowUrls: ['${url}'],`;
  const bodiesSnippet = `
      networkCaptureBodies: true,`;

  const headersSnippet = `
      networkRequestHeaders: ['X-Custom-Header'],
      networkResponseHeaders: ['X-Custom-Header'],`;

  const code = `Sentry.init({
  integrations: [
    new Replay({${
      urlSnippet +
      (['bodies', 'both'].includes(showSnippet) ? bodiesSnippet : '') +
      (['header', 'both'].includes(showSnippet) ? headersSnippet : '')
    }
    }),
  ],
})`;

  const title =
    showSnippet === 'both'
      ? t('Capture Request and Response Headers and Payloads')
      : showSnippet === 'bodies'
      ? t('Capture Request and Response Payloads')
      : t('Capture Request and Response Headers');
  return (
    <StyledInstructions>
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
