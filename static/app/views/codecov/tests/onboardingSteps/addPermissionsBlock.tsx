import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import Link from 'sentry/components/links/link';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {OnboardingStep} from 'sentry/views/codecov/tests/onboardingSteps/onboardingStep';

interface AddPermissionsBlockProps {
  step: string;
}

const PERMISSIONS_SNIPPET = `permissions:
  id-token: write`;

export function AddPermissionsBlock({step}: AddPermissionsBlockProps) {
  const headerText = tct(
    `Step [step]: Add [permissions] block [atTheTopLevel] in your CI YAML file that runs Sentry Prevent`,
    {
      atTheTopLevel: <b>at the top level</b>,
      step,
      permissions: <InlineCodeSnippet>{t('permissions')}</InlineCodeSnippet>,
    }
  );

  return (
    <OnboardingStep.Container>
      <OnboardingStep.Header>{headerText}</OnboardingStep.Header>
      <OnboardingStep.Content>
        <CodeSnippet dark language="yaml">
          {PERMISSIONS_SNIPPET}
        </CodeSnippet>
        <p
          css={css`
            margin-top: ${space(1.5)};
          `}
        >
          {tct(
            'Set this permission at the workflow or job level. For better security, define it at the job level as it limits access to only the job that needs the OIDC token. Learn more about [permissionsSettingLink].',
            {
              permissionsSettingLink: <Link to="">{t('permissions settings')}</Link>,
            }
          )}
        </p>
      </OnboardingStep.Content>
    </OnboardingStep.Container>
  );
}

const InlineCodeSnippet = styled('span')`
  background-color: ${p => p.theme.black};
  color: ${p => p.theme.white};
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.codeFontSize};
  font-weight: ${p => p.theme.fontWeightBold};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(0.75)} ${space(1)};
  line-height: 1;
`;
