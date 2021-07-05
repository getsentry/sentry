import styled from '@emotion/styled';
import amixr from 'sentry-logos/logo-amixr.svg';
import asana from 'sentry-logos/logo-asana.svg';
import asayer from 'sentry-logos/logo-asayer.svg';
import aws from 'sentry-logos/logo-aws.svg';
import vsts from 'sentry-logos/logo-azure.svg';
import bitbucket from 'sentry-logos/logo-bitbucket.svg';
import bitbucketserver from 'sentry-logos/logo-bitbucket-server.svg';
import calixa from 'sentry-logos/logo-calixa.svg';
import campfire from 'sentry-logos/logo-campfire.svg';
import clickup from 'sentry-logos/logo-clickup.svg';
import clubhouse from 'sentry-logos/logo-clubhouse.svg';
import datadog from 'sentry-logos/logo-datadog.svg';
import placeholder from 'sentry-logos/logo-default.svg';
import flowdock from 'sentry-logos/logo-flowdock.svg';
import fullstory from 'sentry-logos/logo-fullstory.svg';
import github from 'sentry-logos/logo-github.svg';
import githubActions from 'sentry-logos/logo-github-actions.svg';
import githubEnterprise from 'sentry-logos/logo-github-enterprise.svg';
import gitlab from 'sentry-logos/logo-gitlab.svg';
import heroku from 'sentry-logos/logo-heroku.svg';
import jira from 'sentry-logos/logo-jira.svg';
import jiraserver from 'sentry-logos/logo-jira-server.svg';
import komodor from 'sentry-logos/logo-komodor.svg';
import lighthouse from 'sentry-logos/logo-lighthouse.svg';
import linear from 'sentry-logos/logo-linear.svg';
import msteams from 'sentry-logos/logo-msteams.svg';
import netlify from 'sentry-logos/logo-netlify.svg';
import octohook from 'sentry-logos/logo-octohook.svg';
import opsgenie from 'sentry-logos/logo-opsgenie.svg';
import pagerduty from 'sentry-logos/logo-pagerduty.svg';
import phabricator from 'sentry-logos/logo-phabricator.svg';
import pivotal from 'sentry-logos/logo-pivotaltracker.svg';
import pushover from 'sentry-logos/logo-pushover.svg';
import quill from 'sentry-logos/logo-quill.svg';
import redmine from 'sentry-logos/logo-redmine.svg';
import rocketchat from 'sentry-logos/logo-rocketchat.svg';
import rookout from 'sentry-logos/logo-rookout.svg';
import segment from 'sentry-logos/logo-segment.svg';
import sentry from 'sentry-logos/logo-sentry.svg';
import slack from 'sentry-logos/logo-slack.svg';
import spikesh from 'sentry-logos/logo-spikesh.svg';
import split from 'sentry-logos/logo-split.svg';
import taiga from 'sentry-logos/logo-taiga.svg';
import teamwork from 'sentry-logos/logo-teamwork.svg';
import trello from 'sentry-logos/logo-trello.svg';
import twilio from 'sentry-logos/logo-twilio.svg';
import vercel from 'sentry-logos/logo-vercel.svg';
import victorops from 'sentry-logos/logo-victorops.svg';
import visualstudio from 'sentry-logos/logo-visualstudio.svg';
import youtrack from 'sentry-logos/logo-youtrack.svg';
import zepel from 'sentry-logos/logo-zepel.svg';
import zulip from 'sentry-logos/logo-zulip.svg';

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
  amixr,
  asana,
  asayer,
  bitbucket,
  bitbucket_pipelines: bitbucket,
  bitbucket_server: bitbucketserver,
  calixa,
  campfire,
  clickup,
  clubhouse,
  datadog,
  flowdock,
  fullstory,
  github,
  github_actions: githubActions,
  github_enterprise: githubEnterprise,
  gitlab,
  heroku,
  jira,
  'jira-atlassian-connect': jira,
  'jira-ac': jira,
  jira_server: jiraserver,
  komodor,
  lighthouse,
  linear,
  msteams,
  netlify,
  octohook,
  opsgenie,
  pagerduty,
  phabricator,
  pivotal,
  pushover,
  quill,
  redmine,
  rocketchat,
  rookout,
  segment,
  slack,
  spikesh,
  split,
  taiga,
  teamwork,
  trello,
  twilio,
  visualstudio,
  vsts,
  youtrack,
  vercel,
  victorops,
  zepel,
  zulip,
};

type Props = {
  pluginId?: string;
  size?: number;
};

const PluginIcon = styled('div')<Props>`
  position: relative;
  height: ${p => p.size}px;
  width: ${p => p.size}px;
  border-radius: 2px;
  border: 0;
  display: inline-block;
  background-size: contain;
  background-position: center center;
  background-repeat: no-repeat;
  background-image: url(${({pluginId}) =>
    (pluginId !== undefined && ICON_PATHS[pluginId]) || DEFAULT_ICON});
`;

PluginIcon.defaultProps = {
  pluginId: '_default',
  size: 20,
};

export default PluginIcon;
