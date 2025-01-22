import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import {IconGithub} from 'sentry/icons/iconGithub';
import {IconGoogle} from 'sentry/icons/iconGoogle';
import {IconVsts} from 'sentry/icons/iconVsts';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface ExternalProviderOptionsProps {
  type: 'signin' | 'signup';
  azureDevOpsLink?: string;
  gitHubLink?: string;
  googleLink?: string;
}

// TODO(epurkhiser): The abstraction here would be much nicer if we just
// exposed a configuration object telling us what auth providers there are.
export function ExternalProviderOptions({
  type,
  googleLink,
  gitHubLink,
  azureDevOpsLink,
}: ExternalProviderOptionsProps) {
  return (
    <ProviderWrapper>
      <ProviderWrapper>
        <ProviderHeading>
          {type === 'signin'
            ? t('External Account Login')
            : t('External Account Register')}
        </ProviderHeading>
        {googleLink && (
          <LinkButton size="sm" icon={<IconGoogle />} href={googleLink}>
            {type === 'signin' ? t('Sign in with Google') : t('Sign up with Google')}
          </LinkButton>
        )}
        {gitHubLink && (
          <LinkButton size="sm" icon={<IconGithub />} href={gitHubLink}>
            {type === 'signin' ? t('Sign in with GitHub') : t('Sign up with GitHub')}
          </LinkButton>
        )}
        {azureDevOpsLink && (
          <LinkButton size="sm" icon={<IconVsts />} href={azureDevOpsLink}>
            {type === 'signin'
              ? t('Sign in with Azure DevOps')
              : t('Sign up with Azure DevOps')}
          </LinkButton>
        )}
      </ProviderWrapper>
    </ProviderWrapper>
  );
}

const ProviderWrapper = styled('div')`
  position: relative;
  display: grid;
  grid-auto-rows: max-content;
  gap: ${space(1.5)};

  &:before {
    position: absolute;
    display: block;
    content: '';
    top: 0;
    bottom: 0;
    left: -30px;
    border-left: 1px solid ${p => p.theme.border};
  }
`;

const ProviderHeading = styled('div')`
  margin: 0;
  font-size: 15px;
  font-weight: ${p => p.theme.fontWeightBold};
  line-height: 24px;
`;
