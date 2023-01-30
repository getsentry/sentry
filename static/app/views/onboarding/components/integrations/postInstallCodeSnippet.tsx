import {Fragment} from 'react';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {PlatformKey} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
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
      <CodeSnippet
        dark
        language={platform === 'python-awslambda' ? 'python' : 'javascript'}
      >
        {`myUndefinedFunction${token_punctuation}`}
      </CodeSnippet>
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
