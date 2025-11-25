import styled from '@emotion/styled';
import asana from 'sentry-logos/logo-asana.svg';
import aws from 'sentry-logos/logo-aws.svg';
import vsts from 'sentry-logos/logo-azure.svg';
import bitbucketserver from 'sentry-logos/logo-bitbucket-server.svg';
import bitbucket from 'sentry-logos/logo-bitbucket.svg';
import cursor from 'sentry-logos/logo-cursor.svg';
import placeholder from 'sentry-logos/logo-default.svg';
import discord from 'sentry-logos/logo-discord.svg';
import githubEnterprise from 'sentry-logos/logo-github-enterprise.svg';
import github from 'sentry-logos/logo-github.svg';
import gitlab from 'sentry-logos/logo-gitlab.svg';
import heroku from 'sentry-logos/logo-heroku.svg';
import jiraserver from 'sentry-logos/logo-jira-server.svg';
import jira from 'sentry-logos/logo-jira.svg';
import jumpcloud from 'sentry-logos/logo-jumpcloud.svg';
import msteams from 'sentry-logos/logo-msteams.svg';
import opsgenie from 'sentry-logos/logo-opsgenie.svg';
import pagerduty from 'sentry-logos/logo-pagerduty.svg';
import perforce from 'sentry-logos/logo-perforce.svg';
import pivotal from 'sentry-logos/logo-pivotaltracker.svg';
import pushover from 'sentry-logos/logo-pushover.svg';
import redmine from 'sentry-logos/logo-redmine.svg';
import segment from 'sentry-logos/logo-segment.svg';
import sentry from 'sentry-logos/logo-sentry.svg';
import slack from 'sentry-logos/logo-slack.svg';
import splunk from 'sentry-logos/logo-splunk.svg';
import trello from 'sentry-logos/logo-trello.svg';
import twilio from 'sentry-logos/logo-twilio.svg';
import vercel from 'sentry-logos/logo-vercel.svg';
import victorops from 'sentry-logos/logo-victorops.svg';
import visualstudio from 'sentry-logos/logo-visualstudio.svg';

// Map of plugin id -> logo filename
const PLUGIN_ICONS = {
  placeholder,
  sentry,
  browsers: sentry,
  device: sentry,
  interface_types: sentry,
  os: sentry,
  urls: sentry,
  webhooks: sentry,
  sqs: aws,
  'amazon-sqs': aws,
  aws_lambda: aws,
  cursor,
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
  perforce,
  pivotal,
  pushover,
  redmine,
  segment,
  slack,
  splunk,
  trello,
  twilio,
  visualstudio,
  vsts,
  vercel,
  victorops,
} satisfies Record<string, string>;

export interface PluginIconProps extends React.RefAttributes<HTMLDivElement> {
  pluginId: keyof typeof PLUGIN_ICONS | (string & {});
  className?: string;
  /**
   * @default 20
   */
  size?: number;
}

export function PluginIcon({pluginId, size = 20, ref, className}: PluginIconProps) {
  return (
    <StyledPluginIconContainer size={size} className={className}>
      <StyledPluginIcon size={size} pluginSrc={getPluginIconSource(pluginId)} ref={ref} />
    </StyledPluginIconContainer>
  );
}

const StyledPluginIconContainer = styled('div')<{
  size: number;
}>`
  height: ${p => p.size}px;
  width: ${p => p.size}px;
  min-width: ${p => p.size}px;
  background-color: ${p => p.theme.white};
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const StyledPluginIcon = styled('div')<{
  pluginSrc: string;
  size: number;
}>`
  position: relative;
  height: ${p => p.size - p.size * 0.2}px;
  width: ${p => p.size - p.size * 0.2}px;
  min-width: ${p => p.size - p.size * 0.2}px;
  border-radius: 2px;
  border: 0;
  display: inline-block;
  background-size: contain;
  background-position: center center;
  background-repeat: no-repeat;
  background-image: url(${p => p.pluginSrc});
`;

function getPluginIconSource(
  pluginId: PluginIconProps['pluginId']
): (typeof PLUGIN_ICONS)[keyof typeof PLUGIN_ICONS] {
  if (!pluginId) {
    return PLUGIN_ICONS.placeholder;
  }

  if (pluginId in PLUGIN_ICONS) {
    return PLUGIN_ICONS[pluginId as keyof typeof PLUGIN_ICONS];
  }

  return PLUGIN_ICONS.placeholder;
}
