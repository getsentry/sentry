import {Fragment, useState} from 'react';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {OnboardingStep} from 'sentry/views/codecov/tests/onboardingSteps/onboardingStep';

interface AddUploadTokenProps {
  step: string;
}

// HARDCODED VALUES FOR TESTING
const FULL_TOKEN = '91b57316-b1ff-4884-8d55-92b9936a05a3';
const TRUNCATED_TOKEN = '********05a3';

export function AddUploadToken({step}: AddUploadTokenProps) {
  const [showTokenDetails, setShowTokenDetails] = useState(false);
  // this value is only used when showing token details
  const [showFullToken, setShowFullToken] = useState(true);
  const [showWarning, setShowWarning] = useState(true);
  const headerText = tct(`Step [step]: Add token as [repositorySecret]`, {
    step,
    // TODO: replace with actual link
    repositorySecret: (
      <Link to="https://github.com/codecov/codecov-test-repo">
        {t('repository secret')}
      </Link>
    ),
  });

  const handleGenerateClick = () => {
    setShowTokenDetails(true);
  };

  const handleDoneClick = () => {
    setShowFullToken(false);
  };

  const handleDismiss = () => {
    setShowWarning(false);
  };

  return (
    <OnboardingStep.Container>
      <OnboardingStep.Header>{headerText}</OnboardingStep.Header>
      <OnboardingStep.Content>
        <p>
          {tct(
            'Sentry requires a token to authenticate uploading your coverage reports. GitHub [repoAdmin] is required to access organization settings > secrets and variables > actions',
            {
              repoAdmin: <b>{t('Repository admin')}</b>,
            }
          )}
        </p>
        {showTokenDetails ? (
          showFullToken ? (
            <Fragment>
              {showWarning && (
                <Alert.Container>
                  <Alert
                    type="warning"
                    data-test-id="page-error-alert"
                    showIcon
                    trailingItems={<IconClose size="sm" onClick={handleDismiss} />}
                  >
                    {t(
                      "Please copy this token to a safe place - it won't be shown again."
                    )}
                  </Alert>
                </Alert.Container>
              )}
              <Flex justify="space-between" gap={space(1)}>
                <Flex justify="space-between" gap={space(1)}>
                  <CodeSnippet dark>SENTRY_PREVENT_TOKEN</CodeSnippet>
                  <CodeSnippet dark>{FULL_TOKEN}</CodeSnippet>
                </Flex>
                <Button priority="primary" onClick={handleDoneClick}>
                  {t('Done')}
                </Button>
              </Flex>
            </Fragment>
          ) : (
            <Flex justify="space-between" gap={space(1)}>
              <Flex justify="space-between" gap={space(1)}>
                <CodeSnippet dark>SENTRY_PREVENT_TOKEN</CodeSnippet>
                <CodeSnippet dark>{TRUNCATED_TOKEN}</CodeSnippet>
              </Flex>
              <Button priority="default" onClick={handleGenerateClick}>
                {t('Regenerate')}
              </Button>
            </Flex>
          )
        ) : (
          <Button priority="primary" onClick={handleGenerateClick}>
            {t('Generate Repository Token')}
          </Button>
        )}
      </OnboardingStep.Content>
    </OnboardingStep.Container>
  );
}
