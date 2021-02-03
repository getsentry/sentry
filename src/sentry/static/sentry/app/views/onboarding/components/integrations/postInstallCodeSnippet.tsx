import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {IntegrationProvider} from 'app/types';

type Props = {
  provider: IntegrationProvider;
  isOnboarding?: boolean;
};

export default function PostInstallCodeSnippet({provider, isOnboarding}: Props) {
  //TODO: dyanically determine the snippet based on the language
  //currently only supporting Node
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
            <TokenPunctuation>();</TokenPunctuation>
          </code>
        </CodeWrapper>
      </div>
      {isOnboarding && (
        <React.Fragment>
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
        </React.Fragment>
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
