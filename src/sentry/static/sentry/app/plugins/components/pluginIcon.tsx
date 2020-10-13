import PropTypes from 'prop-types';
import styled from '@emotion/styled';

import placeholder from 'app/../images/logos/logo-default.svg';
import sentry from 'app/../images/logos/logo-sentry.svg';
import amixr from 'app/../images/logos/logo-amixr.svg';
import asana from 'app/../images/logos/logo-asana.svg';
import asayer from 'app/../images/logos/logo-asayer.svg';
import aws from 'app/../images/logos/logo-aws.svg';
import bitbucket from 'app/../images/logos/logo-bitbucket.svg';
import bitbucketserver from 'app/../images/logos/logo-bitbucket-server.svg';
import campfire from 'app/../images/logos/logo-campfire.svg';
import clickup from 'app/../images/logos/logo-clickup.svg';
import clubhouse from 'app/../images/logos/logo-clubhouse.svg';
import datadog from 'app/../images/logos/logo-datadog.svg';
import flowdock from 'app/../images/logos/logo-flowdock.svg';
import fullstory from 'app/../images/logos/logo-fullstory.svg';
import github from 'app/../images/logos/logo-github.svg';
import githubActions from 'app/../images/logos/logo-github-actions.svg';
import githubEnterprise from 'app/../images/logos/logo-github-enterprise.svg';
import gitlab from 'app/../images/logos/logo-gitlab.svg';
import heroku from 'app/../images/logos/logo-heroku.svg';
import jira from 'app/../images/logos/logo-jira.svg';
import jiraserver from 'app/../images/logos/logo-jira-server.svg';
import lighthouse from 'app/../images/logos/logo-lighthouse.svg';
import linear from 'app/../images/logos/logo-linear.svg';
import msteams from 'app/../images/logos/logo-msteams.svg';
import netlify from 'app/../images/logos/logo-netlify.svg';
import opsgenie from 'app/../images/logos/logo-opsgenie.svg';
import pagerduty from 'app/../images/logos/logo-pagerduty.svg';
import phabricator from 'app/../images/logos/logo-phabricator.svg';
import pivotal from 'app/../images/logos/logo-pivotaltracker.svg';
import pushover from 'app/../images/logos/logo-pushover.svg';
import redmine from 'app/../images/logos/logo-redmine.svg';
import rocketchat from 'app/../images/logos/logo-rocketchat.svg';
import rookout from 'app/../images/logos/logo-rookout.svg';
import segment from 'app/../images/logos/logo-segment.svg';
import slack from 'app/../images/logos/logo-slack.svg';
import split from 'app/../images/logos/logo-split.svg';
import taiga from 'app/../images/logos/logo-taiga.svg';
import teamwork from 'app/../images/logos/logo-teamwork.svg';
import trello from 'app/../images/logos/logo-trello.svg';
import twilio from 'app/../images/logos/logo-twilio.svg';
import visualstudio from 'app/../images/logos/logo-visualstudio.svg';
import vsts from 'app/../images/logos/logo-azure.svg';
import youtrack from 'app/../images/logos/logo-youtrack.svg';
import vercel from 'app/../images/logos/logo-vercel.svg';
import victorops from 'app/../images/logos/logo-victorops.svg';
import zulip from 'app/../images/logos/logo-zulip.svg';

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
  opsgenie,
  pagerduty,
  phabricator,
  pivotal,
  pushover,
  redmine,
  rocketchat,
  rookout,
  segment,
  slack,
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

PluginIcon.propTypes = {
  pluginId: PropTypes.string,
  size: PropTypes.number,
};

export default PluginIcon;
