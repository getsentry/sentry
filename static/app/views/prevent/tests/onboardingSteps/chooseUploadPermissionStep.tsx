import {ExternalLink} from '@sentry/scraps/link';

import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import {t, tct} from 'sentry/locale';
import {OnboardingStep} from 'sentry/views/prevent/tests/onboardingSteps/onboardingStep';

export enum UploadPermission {
  OIDC = 'oidc',
  UPLOAD_TOKEN = 'token',
}

interface ChooseUploadPermissionStepProps {
  selectedUploadPermission: UploadPermission;
  setSelectedUploadPermission: (permission: UploadPermission) => void;
  step: string;
}

const CHOICE_OPTIONS: Array<
  [UploadPermission, string | React.ReactNode, string | React.ReactNode]
> = [
  [
    UploadPermission.OIDC,
    t('Use OpenID Connect (OIDC)'),
    tct(
      'Recommended option, it does not require repo admin privileges to get started. Learn more about [link:OIDC].',
      {
        link: (
          <ExternalLink href="https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/about-security-hardening-with-openid-connect" />
        ),
      }
    ),
  ],
  [
    UploadPermission.UPLOAD_TOKEN,
    t('Use Sentry Prevent Upload Token'),
    t(
      'You will need to generate an upload token, and store it securely in your GitHub repository secret.'
    ),
  ],
];

export function ChooseUploadPermissionStep({
  step,
  selectedUploadPermission,
  setSelectedUploadPermission,
}: ChooseUploadPermissionStepProps) {
  const headerText = tct(`Step [step]: Choose an upload permission`, {step});

  const handleRadioChange = (value: UploadPermission) => {
    setSelectedUploadPermission(value);
  };

  return (
    <OnboardingStep.Container>
      <OnboardingStep.Body>
        <OnboardingStep.Header>{headerText}</OnboardingStep.Header>
        <OnboardingStep.Content>
          <RadioGroup
            label="Choose an upload permission"
            value={selectedUploadPermission}
            onChange={handleRadioChange}
            choices={CHOICE_OPTIONS}
          />
        </OnboardingStep.Content>
      </OnboardingStep.Body>
    </OnboardingStep.Container>
  );
}
