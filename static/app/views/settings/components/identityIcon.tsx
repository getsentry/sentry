import styled from '@emotion/styled';
import asana from 'sentry-logos/logo-asana.svg';
import auth0 from 'sentry-logos/logo-auth0.svg';
import vsts from 'sentry-logos/logo-azure.svg';
import bitbucketserver from 'sentry-logos/logo-bitbucket-server.svg';
import bitbucket from 'sentry-logos/logo-bitbucket.svg';
import placeholder from 'sentry-logos/logo-default.svg';
import githubEnterprise from 'sentry-logos/logo-github-enterprise.svg';
import github from 'sentry-logos/logo-github.svg';
import gitlab from 'sentry-logos/logo-gitlab.svg';
import google from 'sentry-logos/logo-google.svg';
import jiraserver from 'sentry-logos/logo-jira-server.svg';
import jumpcloud from 'sentry-logos/logo-jumpcloud.svg';
import msteams from 'sentry-logos/logo-msteams.svg';
import okta from 'sentry-logos/logo-okta.svg';
import onelogin from 'sentry-logos/logo-onelogin.svg';
import rippling from 'sentry-logos/logo-rippling.svg';
import saml2 from 'sentry-logos/logo-saml2.svg';
import slack from 'sentry-logos/logo-slack.svg';
import visualstudio from 'sentry-logos/logo-visualstudio.svg';

const IDENTITY_ICONS = {
  placeholder,
  'active-directory': vsts,
  asana,
  auth0,
  bitbucket,
  bitbucket_server: bitbucketserver,
  github,
  github_enterprise: githubEnterprise,
  gitlab,
  google,
  jira_server: jiraserver,
  jumpcloud,
  msteams,
  okta,
  onelogin,
  rippling,
  saml2,
  slack,
  visualstudio,
  vsts,
} satisfies Record<string, string>;

export interface IdentityIconProps extends React.RefAttributes<HTMLDivElement> {
  providerId: string | keyof typeof IDENTITY_ICONS;
  /**
   * @default 36
   */
  size?: number;
}

export function IdentityIcon({providerId, size = 36, ref}: IdentityIconProps) {
  return (
    <StyledIdentityIconContainer size={size}>
      <StyledIdentityIcon
        ref={ref}
        size={size}
        identitySrc={getIdentityIconSource(providerId)}
      />
    </StyledIdentityIconContainer>
  );
}

const StyledIdentityIconContainer = styled('div')<{size: number}>`
  height: ${p => p.size}px;
  width: ${p => p.size}px;
  background-color: ${p => p.theme.colors.white};
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const StyledIdentityIcon = styled('div')<{identitySrc: string; size: number}>`
  position: relative;
  height: ${p => p.size - p.size * 0.2}px;
  width: ${p => p.size - p.size * 0.2}px;
  border-radius: 2px;
  border: 0;
  display: inline-block;
  background-size: contain;
  background-position: center center;
  background-repeat: no-repeat;
  background-image: url(${p => p.identitySrc});
`;

function getIdentityIconSource(
  providerId: IdentityIconProps['providerId']
): (typeof IDENTITY_ICONS)[keyof typeof IDENTITY_ICONS] {
  if (!providerId) {
    return IDENTITY_ICONS.placeholder;
  }

  if (providerId in IDENTITY_ICONS) {
    return IDENTITY_ICONS[providerId as keyof typeof IDENTITY_ICONS];
  }

  return IDENTITY_ICONS.placeholder;
}
