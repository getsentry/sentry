import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconFlag} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';

type Props = {
  minSDKVersion: string;
  showSnippet: 'header' | 'bodies' | 'both';
  url: string;
  showSDKUpgrade?: boolean;
};

function NetworkDetailsSetup({minSDKVersion, showSnippet, url, showSDKUpgrade}: Props) {
  const urlSnippet = `
      // Capture headers for any url that includes:
      // '${url}'
      networkDetailAllowUrls: [
        '${url}',
      ],`;
  const bodiesSnippet = `
      // Also capture request & response bodies
      networkCaptureBodies: true,`;

  const headersSnippet = `
      // Capture custom headers
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
      ? t('Capture the headers and body of requests and responses')
      : showSnippet === 'bodies'
      ? t('Capture the body of requests and responses')
      : t('Capture the headers of requests and responses');
  return (
    <OverflowBody>
      <SetupInstructions>
        <IconFlag color="gray300" size="xl" />
        <Title>{title}</Title>
        <p>
          {tct(
            `To protect user privacy Session Replay defaults to not capturing the headers or bodies of requests or responses. However you can enable the feature for matching urls by updating your SDK configuration. [link]`,
            {
              link: (
                <ExternalLink href="https://github.com/getsentry/sentry-javascript/issues/7103">
                  {t('Learn More')}
                </ExternalLink>
              ),
            }
          )}
        </p>
        {showSDKUpgrade ? (
          <p>{tct('Note: SDK [minSDKVersion] is required', {minSDKVersion})}</p>
        ) : null}
      </SetupInstructions>
      <CodeSnippet filename="JavaScript" language="javascript">
        {code}
      </CodeSnippet>
    </OverflowBody>
  );
}

const OverflowBody = styled('div')`
  height: 100%;
  overflow: auto;
`;

const SetupInstructions = styled('div')`
  overflow: auto;
  text-align: center;
  font-size: ${p => p.theme.fontSizeMedium};
  padding-top: ${space(1.5)};

  p {
    margin-bottom: ${space(2)};
  }
`;

const Title = styled('h1')`
  font-size: inherit;
  margin-bottom: ${space(1)};
`;

export default NetworkDetailsSetup;
