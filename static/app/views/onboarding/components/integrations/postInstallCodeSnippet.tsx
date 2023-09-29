import {Fragment} from 'react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import type {PlatformKey} from 'sentry/types';
import {IntegrationProvider} from 'sentry/types';

type Props = {
  provider: IntegrationProvider;
  isOnboarding?: boolean;
  platform?: PlatformKey;
};

export default function PostInstallCodeSnippet({
  provider,
  platform,
  isOnboarding,
}: Props) {
  // currently supporting both Python and Node
  const token_punctuation: string = platform === 'python-awslambda' ? '()' : '();';
  return (
    <div>
      <p>
        {t(
          "Congrats, you just installed the %s integration! Now that it's is installed, the next time you trigger an error it will go to your Sentry.",
          provider.name
        )}
      </p>
      <p>
        {t(
          'This snippet includes an intentional error, so you can test that everything is working as soon as you set it up:'
        )}
      </p>
      <div>
        <CodeWrapper>
          <code>
            <TokenFunction>myUndefinedFunction</TokenFunction>
            <TokenPunctuation>{token_punctuation}</TokenPunctuation>)
          </code>
        </CodeWrapper>
      </div>
      {isOnboarding && (
        <Fragment>
          <p>
            {t(
              "If you're new to Sentry, use the email alert to access your account and complete a product tour."
            )}
          </p>
          <p>
            {t(
              "If you're an existing user and have disabled alerts, you won't receive this email."
            )}
          </p>
        </Fragment>
      )}
    </div>
  );
}

const CodeWrapper = styled('pre')`
  padding: 1em;
  overflow: auto;
  background: #251f3d;
  font-size: 15px;
`;

const TokenFunction = styled('span')`
  color: #7cc5c4;
`;

const TokenPunctuation = styled('span')`
  color: #b3acc1;
`;
