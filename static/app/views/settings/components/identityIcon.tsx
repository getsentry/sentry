import styled from '@emotion/styled';
import asana from 'sentry-logos/logo-asana.svg';
import auth0 from 'sentry-logos/logo-auth0.svg';
import vsts from 'sentry-logos/logo-azure.svg';
import bitbucket from 'sentry-logos/logo-bitbucket.svg';
import bitbucketserver from 'sentry-logos/logo-bitbucket-server.svg';
import placeholder from 'sentry-logos/logo-default.svg';
import github from 'sentry-logos/logo-github.svg';
import githubEnterprise from 'sentry-logos/logo-github-enterprise.svg';
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

// Map of plugin id -> logo filename
export const DEFAULT_ICON = placeholder;

export const ICON_PATHS: Record<string, string> = {
  _default: DEFAULT_ICON,

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
};

type Props = {
  providerId?: string;
  size?: number;
};

const IdentityIcon = styled('div')<Props>`
  position: relative;
  height: ${p => p.size}px;
  width: ${p => p.size}px;
  border-radius: 2px;
  border: 0;
  display: inline-block;
  background-size: contain;
  background-position: center center;
  background-repeat: no-repeat;
  background-image: url(${p =>
    (p.providerId !== undefined && ICON_PATHS[p.providerId]) || DEFAULT_ICON});
`;

IdentityIcon.defaultProps = {
  providerId: '_default',
  size: 36,
};

export default IdentityIcon;
