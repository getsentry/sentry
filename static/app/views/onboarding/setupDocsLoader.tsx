import {useState} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';
import beautify from 'js-beautify';

import {Button} from 'sentry/components/button';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import ExternalLink from 'sentry/components/links/externalLink';
import {DocumentationWrapper} from 'sentry/components/onboarding/documentationWrapper';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';

export function SetupDocsLoader() {
  const [showOptionalConfig, setShowOptionalConfig] = useState(false);
  return (
    <DocsWrapper>
      <DocumentationWrapper>
        <h2>{t('Install')}</h2>
        <p>
          {t(
            'After including this script tag to a page, we’ll send a test error to make sure Sentry is set up correctly.'
          )}
        </p>
        <CodeSnippet dark language="html" onCopy={() => {}}>
          {beautify.html(
            '<script src="https://js.sentry-cdn.com/examplePublicKey.min.js" crossorigin="anonymous"></script>',
            {indent_size: 2}
          )}
        </CodeSnippet>
        <hr />
        <OptionalConfigWrapper>
          <ToogleButton
            priority="link"
            borderless
            size="zero"
            icon={<IconChevron direction={showOptionalConfig ? 'down' : 'right'} />}
            aria-label={t('Toggle optional configuration')}
            onClick={() => setShowOptionalConfig(!showOptionalConfig)}
          />
          <h2>{t('Configuration (Optional)')}</h2>
        </OptionalConfigWrapper>
        {showOptionalConfig && <div>oioioio</div>}
        <hr />
        <h2>{t('Next Steps')}</h2>
        <ul>
          <li>
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/sourcemaps/">
              {t('Source Maps')}
            </ExternalLink>
            {': '}
            {t('Learn how to enable readable stack traces in your Sentry errors.')}
          </li>
          <li>
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/configuration/">
              {t('SDK Configuration')}
            </ExternalLink>
            {': '}
            {t('Learn how to configure your SDK using our Lazy Loader')}
          </li>
        </ul>
      </DocumentationWrapper>
    </DocsWrapper>
  );
}

const DocsWrapper = styled(motion.div)``;

const OptionalConfigWrapper = styled('div')`
  display: flex;
`;

const ToogleButton = styled(Button)`
  &,
  :hover {
    color: ${p => p.theme.gray500};
  }
`;
