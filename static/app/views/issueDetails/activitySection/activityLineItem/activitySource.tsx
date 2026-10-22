import {IconBot} from '@sentry/icons/bot';
import {IconCode} from '@sentry/icons/code';
import {IconCursor} from '@sentry/icons/cursor';
import {IconGithub} from '@sentry/icons/github';
import type {SVGIconProps} from '@sentry/icons/svgIcon';
import {IconTerminal} from '@sentry/icons/terminal';
import {PlatformIcon} from 'platformicons';

import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import type {GroupActivity} from 'sentry/types/group';

export interface ActivitySource {
  /**
   * How the action was taken, e.g. "Claude via MCP"
   */
  description: string;
  icon: React.ReactNode;
}

function glyph(Icon: React.ComponentType<SVGIconProps>) {
  return <Icon aria-hidden size="md" variant="primary" />;
}

function platformLogo(platform: string) {
  return <PlatformIcon platform={platform} size={16} alt="" />;
}

const MCP_CLIENTS: Record<string, {icon: React.ReactNode; name: string}> = {
  'claude-code': {name: 'Claude', icon: platformLogo('anthropic-claude')},
  'claude-desktop': {name: 'Claude', icon: platformLogo('anthropic-claude')},
  codex: {name: 'Codex', icon: platformLogo('openai')},
  copilot: {name: 'GitHub Copilot', icon: glyph(IconGithub)},
  cursor: {name: 'Cursor', icon: glyph(IconCursor)},
  opencode: {name: 'OpenCode', icon: glyph(IconBot)},
};

/**
 * Parses sources like `api`, `sentry-cli` and `mcp:cursor`. Other sources,
 * like `web`, aren't shown.
 */
export function getActivitySource(activity: GroupActivity): ActivitySource | null {
  // Sentry Apps act through the API and are attributed by name instead
  if (!activity.source || activity.sentry_app) {
    return null;
  }

  const [channel, client] = activity.source.split(':');
  switch (channel) {
    case 'api':
      return {icon: glyph(IconCode), description: t('via API')};
    case 'sentry-cli':
      return {icon: glyph(IconTerminal), description: t('via Sentry CLI')};
    case 'mcp': {
      const mcpClient = client ? MCP_CLIENTS[client] : undefined;
      return mcpClient
        ? {icon: mcpClient.icon, description: t('%s via MCP', mcpClient.name)}
        : {icon: glyph(IconBot), description: t('via MCP')};
    }
    default:
      return null;
  }
}

export function ActivitySourceLogo({
  source,
  hasTooltip,
}: {
  source: ActivitySource;
  hasTooltip?: boolean;
}) {
  const logo = (
    // Background hides the timeline line behind the icon
    <Flex as="span" aria-label={source.description} background="primary" role="img">
      {source.icon}
    </Flex>
  );

  return hasTooltip ? (
    <Tooltip title={source.description} skipWrapper>
      {logo}
    </Tooltip>
  ) : (
    logo
  );
}
