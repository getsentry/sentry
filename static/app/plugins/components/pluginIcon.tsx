import styled from '@emotion/styled';
import asana from 'sentry-logos/logo-asana.svg?url';
import aws from 'sentry-logos/logo-aws.svg?url';
import vsts from 'sentry-logos/logo-azure.svg?url';
import bitbucketserver from 'sentry-logos/logo-bitbucket-server.svg?url';
import bitbucket from 'sentry-logos/logo-bitbucket.svg?url';
import cursor from 'sentry-logos/logo-cursor.svg?url';
import placeholder from 'sentry-logos/logo-default.svg?url';
import discord from 'sentry-logos/logo-discord.svg?url';
import githubEnterprise from 'sentry-logos/logo-github-enterprise.svg?url';
import github from 'sentry-logos/logo-github.svg?url';
import gitlab from 'sentry-logos/logo-gitlab.svg?url';
import heroku from 'sentry-logos/logo-heroku.svg?url';
import jiraserver from 'sentry-logos/logo-jira-server.svg?url';
import jira from 'sentry-logos/logo-jira.svg?url';
import jumpcloud from 'sentry-logos/logo-jumpcloud.svg?url';
import msteams from 'sentry-logos/logo-msteams.svg?url';
import opsgenie from 'sentry-logos/logo-opsgenie.svg?url';
import pagerduty from 'sentry-logos/logo-pagerduty.svg?url';
import pivotal from 'sentry-logos/logo-pivotaltracker.svg?url';
import pushover from 'sentry-logos/logo-pushover.svg?url';
import redmine from 'sentry-logos/logo-redmine.svg?url';
import segment from 'sentry-logos/logo-segment.svg?url';
import sentry from 'sentry-logos/logo-sentry.svg?url';
import slack from 'sentry-logos/logo-slack.svg?url';
import trello from 'sentry-logos/logo-trello.svg?url';
import twilio from 'sentry-logos/logo-twilio.svg?url';
import vercel from 'sentry-logos/logo-vercel.svg?url';
import victorops from 'sentry-logos/logo-victorops.svg?url';
import visualstudio from 'sentry-logos/logo-visualstudio.svg?url';

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
