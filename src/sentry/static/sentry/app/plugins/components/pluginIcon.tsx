import PropTypes from 'prop-types';
import styled from 'react-emotion';

import placeholder from 'app/../images/logos/logo-default.svg';
import sentry from 'app/../images/logos/logo-sentry.svg';
import amixr from 'app/../images/logos/logo-amixr.svg';
import asana from 'app/../images/logos/logo-asana.svg';
import bitbucket from 'app/../images/logos/logo-bitbucket.svg';
import campfire from 'app/../images/logos/logo-campfire.svg';
import clickup from 'app/../images/logos/logo-clickup.svg';
import clubhouse from 'app/../images/logos/logo-clubhouse.svg';
import flowdock from 'app/../images/logos/logo-flowdock.svg';
import github from 'app/../images/logos/logo-github.svg';
import githubEnterprise from 'app/../images/logos/logo-github-enterprise.svg';
import gitlab from 'app/../images/logos/logo-gitlab.svg';
import heroku from 'app/../images/logos/logo-heroku.svg';
import jira from 'app/../images/logos/logo-jira.svg';
import jiraserver from 'app/../images/logos/logo-jira-server.svg';
import lighthouse from 'app/../images/logos/logo-lighthouse.svg';
import opsgenie from 'app/../images/logos/logo-opsgenie.svg';
import pagerduty from 'app/../images/logos/logo-pagerduty.svg';
import phabricator from 'app/../images/logos/logo-phabricator.svg';
import pivotal from 'app/../images/logos/logo-pivotaltracker.svg';
import pushover from 'app/../images/logos/logo-pushover.svg';
import redmine from 'app/../images/logos/logo-redmine.svg';
import rookout from 'app/../images/logos/logo-rookout.svg';
import slack from 'app/../images/logos/logo-slack.svg';
import split from 'app/../images/logos/logo-split.svg';
import taiga from 'app/../images/logos/logo-taiga.svg';
import teamwork from 'app/../images/logos/logo-teamwork.svg';
import trello from 'app/../images/logos/logo-trello.svg';
import twilio from 'app/../images/logos/logo-twilio.svg';
import vsts from 'app/../images/logos/logo-azure.svg';
import youtrack from 'app/../images/logos/logo-youtrack.svg';

// Map of plugin id -> logo filename
const DEFAULT_ICON = placeholder;
export const ICON_PATHS = {
  _default: DEFAULT_ICON,
  sentry,
  browsers: sentry,
  device: sentry,
  interface_types: sentry,
  os: sentry,
  urls: sentry,
  webhooks: sentry,

  amixr,
  asana,
  bitbucket,
  campfire,
  clickup,
  clubhouse,
  flowdock,
  github,
  github_enterprise: githubEnterprise,
  gitlab,
  heroku,
  jira,
  'jira-atlassian-connect': jira,
  'jira-ac': jira,
  jira_server: jiraserver,
  lighthouse,
  opsgenie,
  pagerduty,
  phabricator,
  pivotal,
  pushover,
  redmine,
  rookout,
  slack,
  split,
  taiga,
  teamwork,
  trello,
  twilio,
  vsts,
  youtrack,
};

type Props = {
  pluginId?: string;
  size: number;
};

const PluginIcon = styled('div')<Props>`
  position: relative;
  height: ${p => p.size}px;
  width: ${p => p.size}px;
  border-radius: 2px;
  border: 0;
  /* this is so that there aren't gray boxes before load */
  background-color: #fff;
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
  size: PropTypes.number.isRequired,
};

export default PluginIcon;
