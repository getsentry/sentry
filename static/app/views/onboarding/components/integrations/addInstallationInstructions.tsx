import {Fragment} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';

// TODO: Make dyanmic for other platforms/integrations
export default function AddInstallationInstructions() {
  return (
    <Fragment>
      <p>
        {tct(
          'The automated AWS Lambda setup will instrument your Lambda functions with Sentry error and performance monitoring without any code changes. We use CloudFormation Stack ([learnMore]) to create the Sentry role which gives us access to your AWS account.',
          {
            learnMore: (
              <ExternalLink href="https://aws.amazon.com/cloudformation/">
                {t('Learn more about CloudFormation')}
              </ExternalLink>
            ),
          }
        )}
      </p>
      <p>
        {tct(
          'Just press the [addInstallation] button below and complete the steps in the popup that opens.',
          {addInstallation: <strong>{t('Add Installation')}</strong>}
        )}
      </p>
      <p>
        {tct(
          'If you don’t want to add CloudFormation stack to your AWS environment, press the [manualSetup] button instead.',
          {manualSetup: <strong>{t('Manual Setup')}</strong>}
        )}
      </p>
    </Fragment>
  );
}
