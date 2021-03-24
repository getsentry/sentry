import styled from '@emotion/styled';

import amixr from 'sentry-images/logos/logo-amixr.svg';
import asana from 'sentry-images/logos/logo-asana.svg';
import asayer from 'sentry-images/logos/logo-asayer.svg';
import aws from 'sentry-images/logos/logo-aws.svg';
import vsts from 'sentry-images/logos/logo-azure.svg';
import bitbucket from 'sentry-images/logos/logo-bitbucket.svg';
import bitbucketserver from 'sentry-images/logos/logo-bitbucket-server.svg';
import campfire from 'sentry-images/logos/logo-campfire.svg';
import clickup from 'sentry-images/logos/logo-clickup.svg';
import clubhouse from 'sentry-images/logos/logo-clubhouse.svg';
import datadog from 'sentry-images/logos/logo-datadog.svg';
import placeholder from 'sentry-images/logos/logo-default.svg';
import flowdock from 'sentry-images/logos/logo-flowdock.svg';
import fullstory from 'sentry-images/logos/logo-fullstory.svg';
import github from 'sentry-images/logos/logo-github.svg';
import githubActions from 'sentry-images/logos/logo-github-actions.svg';
import githubEnterprise from 'sentry-images/logos/logo-github-enterprise.svg';
import gitlab from 'sentry-images/logos/logo-gitlab.svg';
import heroku from 'sentry-images/logos/logo-heroku.svg';
import jira from 'sentry-images/logos/logo-jira.svg';
import jiraserver from 'sentry-images/logos/logo-jira-server.svg';
import lighthouse from 'sentry-images/logos/logo-lighthouse.svg';
import linear from 'sentry-images/logos/logo-linear.svg';
import msteams from 'sentry-images/logos/logo-msteams.svg';
import netlify from 'sentry-images/logos/logo-netlify.svg';
import octohook from 'sentry-images/logos/logo-octohook.svg';
import opsgenie from 'sentry-images/logos/logo-opsgenie.svg';
import pagerduty from 'sentry-images/logos/logo-pagerduty.svg';
import phabricator from 'sentry-images/logos/logo-phabricator.svg';
import pivotal from 'sentry-images/logos/logo-pivotaltracker.svg';
import pushover from 'sentry-images/logos/logo-pushover.svg';
import quill from 'sentry-images/logos/logo-quill.svg';
import redmine from 'sentry-images/logos/logo-redmine.svg';
import rocketchat from 'sentry-images/logos/logo-rocketchat.svg';
import rookout from 'sentry-images/logos/logo-rookout.svg';
import segment from 'sentry-images/logos/logo-segment.svg';
import sentry from 'sentry-images/logos/logo-sentry.svg';
import slack from 'sentry-images/logos/logo-slack.svg';
import spikesh from 'sentry-images/logos/logo-spikesh.svg';
import split from 'sentry-images/logos/logo-split.svg';
import taiga from 'sentry-images/logos/logo-taiga.svg';
import teamwork from 'sentry-images/logos/logo-teamwork.svg';
import trello from 'sentry-images/logos/logo-trello.svg';
import twilio from 'sentry-images/logos/logo-twilio.svg';
import vercel from 'sentry-images/logos/logo-vercel.svg';
import victorops from 'sentry-images/logos/logo-victorops.svg';
import visualstudio from 'sentry-images/logos/logo-visualstudio.svg';
import youtrack from 'sentry-images/logos/logo-youtrack.svg';
import zepel from 'sentry-images/logos/logo-zepel.svg';
import zulip from 'sentry-images/logos/logo-zulip.svg';

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
