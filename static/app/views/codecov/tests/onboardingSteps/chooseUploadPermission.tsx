import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import Link from 'sentry/components/links/link';
import {t, tct} from 'sentry/locale';
import {OnboardingStep} from 'sentry/views/codecov/tests/onboardingSteps/onboardingStep';

interface ChooseUploadPermissionProps {
  selectedUploadPermission: UploadPermission;
  setSelectedUploadPermission: (permission: UploadPermission) => void;
  step: string;
}

export type UploadPermission = 'oidc' | 'token';

const CHOICE_OPTIONS: Array<
  [UploadPermission, string | React.ReactNode, string | React.ReactNode]
> = [
  [
    'oidc',
    t('Use OpenID Connect (OIDC)'),
    tct(
      'Recommended option, it does not require repo admin privileges to get started. Learn more about [OIDC].',
      {
        OIDC: (
          <Link to="https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/about-security-hardening-with-openid-connect">
            OIDC
          </Link>
        ),
      }
    ),
  ],
  [
    'token',
    t('Use Sentry Prevent Upload Token'),
    t(
      'You will need to generate an upload token, and store it securely in your GitHub repository secret.'
    ),
  ],
];

export function ChooseUploadPermission({
  step,
  selectedUploadPermission,
  setSelectedUploadPermission,
}: ChooseUploadPermissionProps) {
  const headerText = tct(`Step [step]: Choose an upload permission`, {step});

  const handleRadioChange = (value: UploadPermission) => {
    setSelectedUploadPermission(value);
  };

  return (
    <OnboardingStep.Container>
      <OnboardingStep.Header>{headerText}</OnboardingStep.Header>
      <OnboardingStep.Content>
        <RadioGroup
          label="Choose an upload permission"
          value={selectedUploadPermission}
          onChange={handleRadioChange}
          choices={CHOICE_OPTIONS}
        />
      </OnboardingStep.Content>
    </OnboardingStep.Container>
  );
}
