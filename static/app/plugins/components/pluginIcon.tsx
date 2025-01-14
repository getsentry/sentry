import styled from '@emotion/styled';
import asana from 'sentry-logos/logo-asana.svg';
import aws from 'sentry-logos/logo-aws.svg';
import vsts from 'sentry-logos/logo-azure.svg';
import bitbucket from 'sentry-logos/logo-bitbucket.svg';
import bitbucketserver from 'sentry-logos/logo-bitbucket-server.svg';
import placeholder from 'sentry-logos/logo-default.svg';
import discord from 'sentry-logos/logo-discord.svg';
import github from 'sentry-logos/logo-github.svg';
import githubEnterprise from 'sentry-logos/logo-github-enterprise.svg';
import gitlab from 'sentry-logos/logo-gitlab.svg';
import heroku from 'sentry-logos/logo-heroku.svg';
import jira from 'sentry-logos/logo-jira.svg';
import jiraserver from 'sentry-logos/logo-jira-server.svg';
import jumpcloud from 'sentry-logos/logo-jumpcloud.svg';
import msteams from 'sentry-logos/logo-msteams.svg';
import opsgenie from 'sentry-logos/logo-opsgenie.svg';
import pagerduty from 'sentry-logos/logo-pagerduty.svg';
import phabricator from 'sentry-logos/logo-phabricator.svg';
import pivotal from 'sentry-logos/logo-pivotaltracker.svg';
import pushover from 'sentry-logos/logo-pushover.svg';
import redmine from 'sentry-logos/logo-redmine.svg';
import segment from 'sentry-logos/logo-segment.svg';
import sentry from 'sentry-logos/logo-sentry.svg';
import slack from 'sentry-logos/logo-slack.svg';
import trello from 'sentry-logos/logo-trello.svg';
import twilio from 'sentry-logos/logo-twilio.svg';
import vercel from 'sentry-logos/logo-vercel.svg';
import victorops from 'sentry-logos/logo-victorops.svg';
import visualstudio from 'sentry-logos/logo-visualstudio.svg';

// Map of plugin id -> logo filename
export const DEFAULT_ICON = placeholder;
export const ICON_PATHS = {
  _default: DEFAULT_ICON,
  sentry,
  browsers: sentry,
  device: sentry,
  interface_types: sentry,
  os: sentry,
  urls: sentry,
  webhooks: sentry,
  'amazon-sqs': aws,
  aws_lambda: aws,
  asana,
  bitbucket,
  bitbucket_pipelines: bitbucket,
  bitbucket_server: bitbucketserver,
  discord,
  github,
  github_enterprise: githubEnterprise,
  gitlab,
  heroku,
  jira,
  jira_server: jiraserver,
  jumpcloud,
  msteams,
  opsgenie,
  pagerduty,
  phabricator,
  pivotal,
  pushover,
  redmine,
  segment,
  slack,
  trello,
  twilio,
  visualstudio,
  vsts,
  vercel,
  victorops,
};

type Props = {
  pluginId?: string;
  size?: number;
};

const PluginIcon = styled('div')<Props>`
  position: relative;
  height: ${p => p.size}px;
  width: ${p => p.size}px;
  min-width: ${p => p.size}px;
  border-radius: 2px;
  border: 0;
  display: inline-block;
  background-size: contain;
  background-position: center center;
  background-repeat: no-repeat;
  background-image: url(${({pluginId}) =>
    // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    (pluginId !== undefined && ICON_PATHS[pluginId]) || DEFAULT_ICON});
`;

PluginIcon.defaultProps = {
  pluginId: '_default',
  size: 20,
};

export default PluginIcon;
