import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import placeholder from '../../../images/integrations/integration-default.png';
import sentry from '../../../images/integrations/integration-sentry.png';
import asana from '../../../images/integrations/asana-logo.png';
import bitbucket from '../../../images/integrations/bitbucket-logo.png';
import campfire from '../../../images/integrations/campfire-logo.png';
import flowdock from '../../../images/integrations/flowdock-logo.png';
import github from '../../../images/integrations/github-logo.png';
import gitlab from '../../../images/integrations/gitlab-logo.png';
import heroku from '../../../images/integrations/heroku-logo.png';
import hipchat from '../../../images/integrations/hipchat-logo.png';
import jira from '../../../images/integrations/jira-logo.png';
import lighthouse from '../../../images/integrations/lighthouse-logo.png';
import opsgenie from '../../../images/integrations/opsgenie-logo.png';
import pagerduty from '../../../images/integrations/pagerduty-logo.png';
import phabricator from '../../../images/integrations/phabricator-logo.png';
import pivotal from '../../../images/integrations/pivotaltracker-logo.png';
import pushover from '../../../images/integrations/pushover-logo.png';
import redmine from '../../../images/integrations/redmine-logo.png';
import slack from '../../../images/integrations/slack-logo.png';
import taiga from '../../../images/integrations/taiga-logo.png';
import teamwork from '../../../images/integrations/teamwork-logo.png';
import trello from '../../../images/integrations/trello-logo.png';
import twilio from '../../../images/integrations/twilio-logo.png';
import vsts from '../../../images/integrations/vsts-logo.svg';
import youtrack from '../../../images/integrations/youtrack-logo.png';

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
  flowdock,
  github,
  gitlab,
  heroku,
  hipchat,
  'hipchat-ac': hipchat,
  jira,
  'jira-atlassian-connect': jira,
  'jira-ac': jira,
  lighthouse,
  opsgenie,
  pagerduty,
  phabricator,
  pivotal,
  pushover,
  redmine,
  slack,
  taiga,
  teamwork,
  trello,
  twilio,
  vsts,
  youtrack,
};

const IntegrationIcon = styled.div`
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
  background-image: url(${p => p.image});
`;

class PluginIcon extends React.Component {
  static propTypes = {
    pluginId: PropTypes.string,
    size: PropTypes.number,
  };

  static defaultProps = {
    pluginId: '_default',
    size: 20,
  };

  render() {
    let {pluginId, size, ...props} = this.props;
    let src = ICON_PATHS[pluginId] || DEFAULT_ICON;

    return <IntegrationIcon {...props} image={src} size={size} />;
  }
}

export default PluginIcon;
