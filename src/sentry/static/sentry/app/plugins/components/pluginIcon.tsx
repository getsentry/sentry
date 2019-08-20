import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import placeholder from 'app/../images/integrations/integration-default.png';
import sentry from 'app/../images/integrations/integration-sentry.png';
import asana from 'app/../images/integrations/asana-logo.png';
import bitbucket from 'app/../images/integrations/bitbucket-logo.png';
import campfire from 'app/../images/integrations/campfire-logo.png';
import clubhouse from 'app/../images/integrations/clubhouse-logo.png';
import flowdock from 'app/../images/integrations/flowdock-logo.png';
import github from 'app/../images/integrations/github-logo.png';
import githubEnterprise from 'app/../images/integrations/github-enterprise-logo.png';
import gitlab from 'app/../images/integrations/gitlab-logo.png';
import heroku from 'app/../images/integrations/heroku-logo.png';
import jira from 'app/../images/integrations/jira-logo.png';
import jiraserver from 'app/../images/integrations/jira-server-logo.png';
import lighthouse from 'app/../images/integrations/lighthouse-logo.png';
import opsgenie from 'app/../images/integrations/opsgenie-logo.png';
import pagerduty from 'app/../images/integrations/pagerduty-logo.png';
import phabricator from 'app/../images/integrations/phabricator-logo.png';
import pivotal from 'app/../images/integrations/pivotaltracker-logo.png';
import pushover from 'app/../images/integrations/pushover-logo.png';
import redmine from 'app/../images/integrations/redmine-logo.png';
import rookout from 'app/../images/integrations/rookout-logo.png';
import slack from 'app/../images/integrations/slack-logo.png';
import taiga from 'app/../images/integrations/taiga-logo.png';
import teamwork from 'app/../images/integrations/teamwork-logo.png';
import trello from 'app/../images/integrations/trello-logo.png';
import twilio from 'app/../images/integrations/twilio-logo.png';
import vsts from 'app/../images/integrations/azure-devops.png';
import youtrack from 'app/../images/integrations/youtrack-logo.png';

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

  asana,
  bitbucket,
  campfire,
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
  taiga,
  teamwork,
  trello,
  twilio,
  vsts,
  youtrack,
};

type IntegrationIconProps = {
  image: string;
  size: number;
};

const IntegrationIcon = styled('div')`
  position: relative;
  height: ${(p: IntegrationIconProps) => p.size}px;
  width: ${(p: IntegrationIconProps) => p.size}px;
  border-radius: 2px;
  border: 0;
  /* this is so that there aren't gray boxes before load */
  background-color: #fff;
  display: inline-block;
  background-size: contain;
  background-position: center center;
  background-repeat: no-repeat;
  background-image: url(${(p: IntegrationIconProps) => p.image});
`;

type Props = {
  pluginId?: string;
  size: number;
};

class PluginIcon extends React.Component<Props> {
  static propTypes = {
    pluginId: PropTypes.string,
    size: PropTypes.number.isRequired,
  };

  static defaultProps = {
    pluginId: '_default',
    size: 20,
  };

  render() {
    const {pluginId, size, ...props} = this.props;
    const src = (pluginId !== undefined && ICON_PATHS[pluginId]) || DEFAULT_ICON;

    return <IntegrationIcon {...props} image={src} size={size} />;
  }
}

export default PluginIcon;
