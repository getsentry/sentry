import styled from '@emotion/styled';
import asana from 'sentry-logos/logo-asana.svg?url';
import auth0 from 'sentry-logos/logo-auth0.svg?url';
import vsts from 'sentry-logos/logo-azure.svg?url';
import bitbucketserver from 'sentry-logos/logo-bitbucket-server.svg?url';
import bitbucket from 'sentry-logos/logo-bitbucket.svg?url';
import placeholder from 'sentry-logos/logo-default.svg?url';
import githubEnterprise from 'sentry-logos/logo-github-enterprise.svg?url';
import github from 'sentry-logos/logo-github.svg?url';
import gitlab from 'sentry-logos/logo-gitlab.svg?url';
import google from 'sentry-logos/logo-google.svg?url';
import jiraserver from 'sentry-logos/logo-jira-server.svg?url';
import jumpcloud from 'sentry-logos/logo-jumpcloud.svg?url';
import msteams from 'sentry-logos/logo-msteams.svg?url';
import okta from 'sentry-logos/logo-okta.svg?url';
import onelogin from 'sentry-logos/logo-onelogin.svg?url';
import rippling from 'sentry-logos/logo-rippling.svg?url';
import saml2 from 'sentry-logos/logo-saml2.svg?url';
import slack from 'sentry-logos/logo-slack.svg?url';
import visualstudio from 'sentry-logos/logo-visualstudio.svg?url';

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
  background-color: ${p => p.theme.white};
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
