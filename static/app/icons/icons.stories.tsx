import React, {Fragment, isValidElement} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import lowerFirst from 'lodash/lowerFirst';
import {parseAsString, useQueryState} from 'nuqs';
import {PlatformIcon, platforms} from 'platformicons';

import {InlineCode} from '@sentry/scraps/code';

import {Tag} from 'sentry/components/core/badge/tag';
import {Input} from 'sentry/components/core/input';
import {Container, Flex, Grid, Stack} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import {Sticky} from 'sentry/components/sticky';
import * as Icons from 'sentry/icons';
import {PluginIcon, type PluginIconProps} from 'sentry/plugins/components/pluginIcon';
import {fzf} from 'sentry/utils/profiling/fzf/fzf';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import useKeyPress from 'sentry/utils/useKeyPress';
import {usePrismTokens} from 'sentry/utils/usePrismTokens';
import {
  IdentityIcon,
  type IdentityIconProps,
} from 'sentry/views/settings/components/identityIcon';

type TIcon = {
  id: string;
  name: string;
  additionalProps?: string[];
  defaultProps?: Record<string, unknown>;
  groups?: string[];
  keywords?: string[];
};
type TSection = {
  icons: TIcon[];
  id: string;
  label: string;
};

const SECTIONS: TSection[] = [
  {
    id: 'product',
    label: 'Product',
    icons: [
      {
        id: 'compass',
        groups: ['product'],
        keywords: ['explore', 'navigation', 'direction', 'discover'],
        name: 'Compass',
        defaultProps: {},
      },
      {
        id: 'dashboard',
        groups: ['product'],
        keywords: ['overview', 'group', 'organize', 'widgets'],
        name: 'Dashboard',
        defaultProps: {},
      },
      {
        id: 'stats',
        groups: ['product'],
        keywords: ['bar', 'graph', 'chart', 'metrics', 'analytics'],
        name: 'Stats',
        defaultProps: {},
      },
      {
        id: 'project',
        groups: ['product'],
        keywords: ['folder', 'repository', 'workspace'],
        name: 'Project',
        defaultProps: {},
      },
      {
        id: 'prevent',
        groups: ['product'],
        keywords: ['shield', 'protect', 'security', 'block', 'defense'],
        name: 'Prevent',
        defaultProps: {},
      },
      {
        id: 'issues',
        groups: ['product'],
        keywords: ['stack', 'bugs', 'errors', 'problems'],
        name: 'Issues',
        defaultProps: {},
      },
      {
        id: 'releases',
        groups: ['product'],
        keywords: ['stack', 'versions', 'deploy', 'deployment'],
        name: 'Releases',
        defaultProps: {},
      },
      {
        id: 'support',
        groups: ['product'],
        keywords: ['microphone', 'help'],
        name: 'Support',
        defaultProps: {},
      },
      {
        id: 'settings',
        groups: ['product'],
        keywords: ['preference', 'config', 'gear', 'cog', 'configure'],
        name: 'Settings',
        defaultProps: {},
      },
      {
        id: 'lab',
        groups: ['product'],
        keywords: ['experiment', 'test'],
        name: 'Lab',
        additionalProps: ['isSolid'],
        defaultProps: {
          isSolid: false,
        },
      },
      {
        id: 'lab-isSolid',
        groups: ['product'],
        keywords: ['experiment', 'test'],
        name: 'Lab',
        additionalProps: ['isSolid'],
        defaultProps: {
          isSolid: true,
        },
      },
      {
        id: 'broadcast',
        groups: ['product'],
        keywords: ['stream', 'radio', 'signal', 'transmit'],
        name: 'Broadcast',
        defaultProps: {},
      },
      {
        id: 'wifi',
        groups: ['product'],
        keywords: ['internet', 'wireless', 'connection', 'network'],
        name: 'Wifi',
        defaultProps: {},
      },
      {
        id: 'telescope',
        groups: ['product'],
        keywords: ['observe', 'watch', 'look', 'spy', 'scope'],
        name: 'Telescope',
        defaultProps: {},
      },
      {
        id: 'lightning',
        groups: ['product'],
        keywords: ['feature', 'new', 'fresh', 'fast', 'speed', 'bolt'],
        name: 'Lightning',
        defaultProps: {},
      },
      {
        id: 'business',
        groups: ['product'],
        keywords: ['feature', 'promotion', 'fresh', 'new', 'briefcase', 'work'],
        name: 'Business',
        defaultProps: {},
      },
      {
        id: 'siren',
        groups: ['product'],
        keywords: ['alert', 'important', 'warning'],
        name: 'Siren',
        defaultProps: {},
      },
      {
        id: 'profiling',
        groups: ['product', 'chart'],
        keywords: ['performance', 'span', 'flame', 'icicle'],
        name: 'Profiling',
        defaultProps: {},
      },
      {
        id: 'timer',
        groups: ['product', 'action'],
        keywords: ['cron', 'monitors', 'clock', 'cycle'],
        name: 'Timer',
        defaultProps: {},
      },
      {
        id: 'seer',
        groups: ['product', 'seer'],
        keywords: ['seer', 'ai', 'eye', 'pyramid'],
        name: 'Seer',
        defaultProps: {},
      },
      {
        id: 'seer-waiting',
        groups: ['product', 'seer'],
        keywords: ['seer', 'ai', 'eye', 'pyramid'],
        name: 'Seer',
        defaultProps: {animation: 'waiting'},
      },
      {
        id: 'seer-loading',
        groups: ['product', 'seer'],
        keywords: ['seer', 'ai', 'eye', 'pyramid'],
        name: 'Seer',
        defaultProps: {animation: 'loading'},
      },
      {
        id: 'my-projects',
        groups: ['product'],
        keywords: ['starred', 'sidebar', 'project', 'locked', 'private'],
        name: 'MyProjects',
        defaultProps: {},
      },
      {
        id: 'all-projects',
        groups: ['product'],
        keywords: [
          'starred',
          'sidebar',
          'project',
          'open',
          'public',
          'organization',
          'all',
        ],
        name: 'AllProjects',
        defaultProps: {},
      },

      {
        id: 'building',
        groups: ['product'],
        keywords: [
          'business',
          'office',
          'company',
          'corporate',
          'organization',
          'integration',
          'github',
          'external',
          'integratedOrganization',
        ],
        name: 'Building',
        defaultProps: {},
      },
      {
        id: 'branch',
        groups: ['product'],
        keywords: ['git', 'version control', 'branch', 'development', 'code'],
        name: 'Branch',
        defaultProps: {},
      },
      {
        id: 'repository',
        groups: ['product'],
        keywords: ['git', 'repo', 'code', 'version control', 'project'],
        name: 'Repository',
        defaultProps: {},
      },
    ],
  },
  {
    id: 'logo',
    label: 'Logos',
    icons: [
      {
        id: 'sentry',
        groups: ['logo'],
        keywords: ['logo', 'brand', 'monitoring', 'error'],
        name: 'Sentry',
        defaultProps: {},
      },
      {
        id: 'sentry-pride',
        groups: ['logo'],
        keywords: ['logo', 'brand', 'rainbow', 'pride', 'lgbtq'],
        name: 'SentryPrideLogo',
        defaultProps: {},
      },
      {
        id: 'codecov',
        groups: ['logo'],
        keywords: ['coverage', 'testing', 'code'],
        name: 'Codecov',
        defaultProps: {},
      },
      {
        id: 'bitbucket',
        groups: ['logo'],
        keywords: ['git', 'repository', 'code', 'atlassian'],
        name: 'Bitbucket',
        defaultProps: {},
      },
      {
        id: 'discord',
        groups: ['logo'],
        keywords: ['chat', 'messaging', 'communication'],
        name: 'Discord',
        defaultProps: {},
      },
      {
        id: 'github',
        groups: ['logo'],
        keywords: ['git', 'repository', 'code', 'microsoft'],
        name: 'Github',
        defaultProps: {},
      },
      {
        id: 'gitlab',
        groups: ['logo'],
        keywords: ['git', 'repository', 'code', 'devops'],
        name: 'Gitlab',
        defaultProps: {},
      },
      {
        id: 'google',
        groups: ['logo'],
        keywords: ['search', 'cloud', 'auth'],
        name: 'Google',
        defaultProps: {},
      },
      {
        id: 'jira',
        groups: ['logo'],
        keywords: ['tickets', 'issues', 'project', 'atlassian'],
        name: 'Jira',
        defaultProps: {},
      },
      {
        id: 'trello',
        groups: ['logo'],
        keywords: ['boards', 'cards', 'project', 'atlassian'],
        name: 'Trello',
        defaultProps: {},
      },
      {
        id: 'vsts',
        groups: ['logo'],
        keywords: ['azure', 'devops', 'microsoft', 'visual studio'],
        name: 'Vsts',
        defaultProps: {},
      },
      {
        id: 'generic',
        groups: ['logo'],
        keywords: ['placeholder', 'default', 'unknown'],
        name: 'Generic',
        defaultProps: {},
      },
      {
        id: 'asana',
        groups: ['logo'],
        keywords: ['project', 'task', 'management'],
        name: 'Asana',
        defaultProps: {},
      },
      {
        id: 'vercel',
        groups: ['logo'],
        keywords: ['deploy', 'hosting', 'frontend'],
        name: 'Vercel',
        defaultProps: {},
      },
      {
        id: 'linear',
        groups: ['logo'],
        keywords: ['tickets', 'issues', 'project', 'linear'],
        name: 'Linear',
        defaultProps: {},
      },
    ],
  },
  {
    id: 'navigation',
    label: 'Navigation',
    icons: [
      {
        id: 'chevron-direction-left',
        groups: ['navigation'],
        keywords: [
          'left',
          'point',
          'direct',
          'move',
          'arrow',
          'back',
          'previous',
          'west',
        ],
        additionalProps: ['direction', 'isDouble'],
        name: 'Chevron',
        defaultProps: {
          direction: 'left',
          isDouble: false,
        },
      },
      {
        id: 'chevron-direction-right',
        groups: ['navigation'],
        keywords: [
          'right',
          'point',
          'direct',
          'move',
          'arrow',
          'forward',
          'next',
          'east',
        ],
        name: 'Chevron',
        defaultProps: {
          direction: 'right',
        },
      },
      {
        id: 'chevron-direction-up',
        groups: ['navigation'],
        keywords: ['up', 'point', 'direct', 'move', 'arrow', 'top', 'north', 'collapse'],
        name: 'Chevron',
        defaultProps: {
          direction: 'up',
        },
      },
      {
        id: 'chevron-direction-down',
        groups: ['navigation'],
        keywords: [
          'down',
          'point',
          'direct',
          'move',
          'arrow',
          'bottom',
          'south',
          'expand',
        ],
        name: 'Chevron',
        defaultProps: {
          direction: 'down',
        },
      },
      {
        id: 'chevron-isDouble-direction-left',
        groups: ['navigation'],
        keywords: [
          'left',
          'point',
          'direct',
          'move',
          'arrow',
          'double',
          'back',
          'previous',
          'west',
          'fast',
          'skip',
          'jump',
        ],
        name: 'Chevron',
        defaultProps: {
          isDouble: true,
          direction: 'left',
        },
      },
      {
        id: 'chevron-isDouble-direction-right',
        groups: ['navigation'],
        keywords: [
          'right',
          'point',
          'direct',
          'move',
          'arrow',
          'double',
          'forward',
          'next',
          'east',
          'fast',
          'skip',
          'jump',
        ],
        name: 'Chevron',
        defaultProps: {
          isDouble: true,
          direction: 'right',
        },
      },
      {
        id: 'chevron-isDouble-direction-up',
        groups: ['navigation'],
        keywords: [
          'up',
          'point',
          'direct',
          'move',
          'arrow',
          'double',
          'top',
          'north',
          'collapse',
          'fast',
          'skip',
          'jump',
        ],
        name: 'Chevron',
        defaultProps: {
          isDouble: true,
          direction: 'up',
        },
      },
      {
        id: 'chevron-isDouble-direction-down',
        groups: ['navigation'],
        keywords: [
          'down',
          'point',
          'direct',
          'move',
          'arrow',
          'double',
          'bottom',
          'south',
          'expand',
          'fast',
          'skip',
          'jump',
        ],
        name: 'Chevron',
        defaultProps: {
          isDouble: true,
          direction: 'down',
        },
      },
      {
        id: 'arrow-direction-left',
        groups: ['navigation'],
        keywords: ['left', 'point', 'direct', 'move', 'back', 'previous', 'west'],
        additionalProps: ['direction'],
        name: 'Arrow',
        defaultProps: {
          direction: 'left',
        },
      },
      {
        id: 'arrow-direction-right',
        groups: ['navigation'],
        keywords: ['right', 'point', 'direct', 'move', 'forward', 'next', 'east'],
        name: 'Arrow',
        defaultProps: {
          direction: 'right',
        },
      },
      {
        id: 'arrow-direction-up',
        groups: ['navigation'],
        keywords: ['up', 'point', 'direct', 'move', 'top', 'north', 'ascend'],
        name: 'Arrow',
        defaultProps: {
          direction: 'up',
        },
      },
      {
        id: 'arrow-direction-down',
        groups: ['navigation'],
        keywords: ['down', 'point', 'direct', 'move', 'bottom', 'south', 'descend'],
        name: 'Arrow',
        defaultProps: {
          direction: 'down',
        },
      },
      {
        id: 'panel-direction-left',
        groups: ['navigation'],
        keywords: ['sidebar', 'footer', 'header', 'drawer', 'window', 'pane'],
        additionalProps: ['direction'],
        name: 'Panel',
        defaultProps: {
          direction: 'left',
        },
      },
      {
        id: 'panel-direction-right',
        groups: ['navigation'],
        keywords: [
          'sidebar',
          'footer',
          'header',
          'drawer',
          'window',
          'pane',
          'right',
          'east',
        ],
        name: 'Panel',
        defaultProps: {
          direction: 'right',
        },
      },
      {
        id: 'panel-direction-up',
        groups: ['navigation'],
        keywords: [
          'sidebar',
          'footer',
          'header',
          'drawer',
          'window',
          'pane',
          'up',
          'top',
          'north',
        ],
        name: 'Panel',
        defaultProps: {
          direction: 'up',
        },
      },
      {
        id: 'panel-direction-down',
        groups: ['navigation'],
        keywords: [
          'sidebar',
          'footer',
          'header',
          'drawer',
          'window',
          'pane',
          'down',
          'bottom',
          'south',
        ],
        name: 'Panel',
        defaultProps: {
          direction: 'down',
        },
      },
      {
        id: 'slashFoward',
        groups: ['navigation'],
        keywords: ['breadcrumbs', 'directory'],
        name: 'SlashForward',
        defaultProps: {},
      },
    ],
  },
  {
    id: 'status',
    label: 'Status',
    icons: [
      {
        id: 'angry',
        groups: ['status'],
        keywords: ['angry', 'rage', 'face', 'mad', 'upset', 'emotion'],
        name: 'Angry',
        defaultProps: {},
      },
      {
        id: 'lock',
        groups: ['action', 'status'],
        keywords: ['secure', 'private', 'protected', 'key'],
        additionalProps: ['locked'],
        name: 'Lock',
        defaultProps: {
          locked: false,
        },
      },
      {
        id: 'lock-locked',
        name: 'Lock',
        defaultProps: {
          locked: true,
        },
      },
      {
        id: 'fire',
        groups: ['status'],
        keywords: ['danger', 'severe', 'critical', 'emergency', 'hot'],
        name: 'Fire',
        defaultProps: {},
      },
      {
        id: 'fatal',
        groups: ['status'],
        keywords: ['skull', 'death', 'dead', 'error', 'critical'],
        name: 'Fatal',
        defaultProps: {},
      },
      {
        id: 'warning',
        groups: ['status'],
        keywords: ['alert', 'notification', 'caution', 'triangle'],
        name: 'Warning',
        defaultProps: {},
      },
      {
        id: 'exclamation',
        groups: ['status'],
        keywords: ['alert', 'warning', 'important', 'notice'],
        name: 'Exclamation',
        defaultProps: {},
      },
      {
        id: 'not',
        groups: ['status'],
        keywords: ['invalid', 'no', 'forbidden', 'block', 'stop', 'denied'],
        name: 'Not',
        defaultProps: {},
      },
      {
        id: 'circle',
        groups: ['status'],
        keywords: ['shape', 'round', 'dot', 'indicator'],
        name: 'Circle',
        defaultProps: {},
      },
      {
        id: 'circleFill',
        groups: ['status'],
        keywords: ['shape', 'round', 'dot', 'indicator', 'filled'],
        name: 'CircleFill',
        defaultProps: {},
      },
      {
        id: 'diamond',
        groups: ['status'],
        keywords: ['shape', 'alert', 'diamond', 'gem', 'precious'],
        name: 'Diamond',
        defaultProps: {},
      },
      {
        id: 'flag',
        groups: ['status'],
        keywords: ['bookmark', 'mark', 'save', 'warning', 'message', 'report'],
        name: 'Flag',
        defaultProps: {},
      },
      {
        id: 'happy',
        groups: ['status'],
        keywords: ['good', 'smile', 'positive', 'joy', 'emotion', 'face'],
        name: 'Happy',
        defaultProps: {},
      },
      {
        id: 'meh',
        groups: ['status'],
        keywords: ['meh', 'neutral', 'okay', 'average', 'emotion', 'face'],
        name: 'Meh',
        defaultProps: {},
      },
      {
        id: 'sad',
        groups: ['status'],
        keywords: ['poor', 'frown', 'negative', 'down', 'emotion', 'face'],
        name: 'Sad',
        defaultProps: {},
      },
      {
        id: 'bot',
        groups: ['status'],
        keywords: ['bot', 'ai'],
        name: 'Bot',
        defaultProps: {},
      },
    ],
  },
  {
    id: 'action',
    label: 'Action',
    icons: [
      {
        id: 'add',
        groups: ['action'],
        keywords: ['plus', 'create', 'new', 'insert', 'math'],
        name: 'Add',
        defaultProps: {},
      },
      {
        id: 'subtract',
        groups: ['action'],
        keywords: ['minus', 'remove', 'decrease', 'delete', 'math'],
        name: 'Subtract',
        defaultProps: {},
      },
      {
        id: 'checkmark',
        groups: ['action'],
        keywords: ['done', 'finish', 'success', 'confirm', 'resolve'],
        name: 'Checkmark',
        defaultProps: {},
      },
      {
        id: 'close',
        groups: ['action'],
        keywords: ['cross', 'deny', 'terminate', 'x', 'cancel', 'exit'],
        name: 'Close',
        defaultProps: {},
      },
      {
        id: 'divide',
        groups: ['action'],
        keywords: ['divided', 'math', 'split', 'separate'],
        name: 'Divide',
        defaultProps: {},
      },
      {
        id: 'upload',
        groups: ['action'],
        keywords: ['file', 'image', 'up', 'send', 'attach'],
        name: 'Upload',
        defaultProps: {},
      },
      {
        id: 'ruler',
        groups: ['ruler'],
        keywords: ['ruler', 'measure'],
        name: 'Ruler',
        defaultProps: {},
      },
      {
        id: 'download',
        groups: ['action'],
        keywords: ['file', 'image', 'down', 'save', 'get'],
        name: 'Download',
        defaultProps: {},
      },
      {
        id: 'scrollHorizontally',
        groups: ['action'],
        keywords: ['scroll', 'swipe'],
        name: 'ScrollHorizontally',
        defaultProps: {},
      },
      {
        id: 'scrollVertically',
        groups: ['action'],
        keywords: ['scroll', 'swipe'],
        name: 'ScrollVertically',
        defaultProps: {},
      },
      {
        id: 'sync',
        groups: ['action'],
        keywords: ['swap', 'refresh', 'update', 'synchronize'],
        name: 'Sync',
        defaultProps: {},
      },
      {
        id: 'menu',
        groups: ['action'],
        keywords: ['navigate', 'hamburger', 'bars', 'options'],
        name: 'Menu',
        defaultProps: {},
      },
      {
        id: 'list',
        groups: ['action'],
        keywords: ['item', 'lines', 'bullet', 'organize'],
        name: 'List',
        defaultProps: {},
      },
      {
        id: 'upgrade',
        groups: ['action'],
        keywords: ['up', 'improve', 'enhance', 'promote'],
        name: 'Upgrade',
        defaultProps: {},
      },
      {
        id: 'open',
        groups: ['action'],
        keywords: ['link', 'hyperlink', 'external', 'launch', 'visit'],
        name: 'Open',
        defaultProps: {},
      },
      {
        id: 'refresh',
        groups: ['action'],
        keywords: ['reload', 'restart', 'repeat', 'update', 'sync'],
        name: 'Refresh',
        defaultProps: {},
      },
      {
        id: 'bookmark',
        groups: ['action'],
        keywords: ['favorite', 'star', 'mark'],
        additionalProps: ['isSolid'],
        name: 'Bookmark',
        defaultProps: {
          isSolid: false,
        },
      },
      {
        id: 'bookmark-isSolid',
        name: 'Bookmark',
        defaultProps: {
          isSolid: true,
        },
      },
      {
        id: 'pin',
        groups: ['action'],
        keywords: ['stick', 'attach', 'fix', 'pushpin'],
        additionalProps: ['isSolid'],
        name: 'Pin',
        defaultProps: {
          isSolid: false,
        },
      },
      {
        id: 'pin-isSolid',
        name: 'Pin',
        defaultProps: {
          isSolid: true,
        },
      },
      {
        id: 'star',
        groups: ['action'],
        keywords: ['favorite', 'star', 'bookmark'],
        additionalProps: ['isSolid'],
        name: 'Star',
        defaultProps: {
          isSolid: false,
        },
      },
      {
        id: 'star-isSolid',
        name: 'Star',
        defaultProps: {
          isSolid: true,
        },
      },
      {
        id: 'play',
        groups: ['action'],
        keywords: ['video', 'audio', 'unpause'],
        name: 'Play',
        defaultProps: {},
      },
      {
        id: 'pause',
        groups: ['action'],
        keywords: ['video', 'audio', 'stop'],
        name: 'Pause',
        defaultProps: {},
      },
      {
        id: 'previous',
        groups: ['action'],
        keywords: ['video', 'audio', 'back', 'rewind'],
        name: 'Previous',
        defaultProps: {},
      },
      {
        id: 'next',
        groups: ['action'],
        keywords: ['video', 'audio', 'skip', 'forward'],
        name: 'Next',
        defaultProps: {},
      },
      {
        id: 'search',
        groups: ['action'],
        keywords: ['find', 'look', 'query'],
        name: 'Search',
        defaultProps: {},
      },
      {
        id: 'copy',
        groups: ['action'],
        keywords: ['duplicate', 'clone', 'clipboard'],
        name: 'Copy',
        defaultProps: {},
      },
      {
        id: 'delete',
        groups: ['action'],
        keywords: ['trash', 'can', 'dumpster', 'remove', 'erase', 'clear'],
        name: 'Delete',
        defaultProps: {},
      },
      {
        id: 'docs',
        groups: ['action'],
        keywords: ['document', 'file', 'paper', 'documentation'],
        name: 'Docs',
        defaultProps: {},
      },
      {
        id: 'link',
        groups: ['action'],
        keywords: ['hyperlink', 'chain', 'connect', 'url'],
        name: 'Link',
        defaultProps: {},
      },
      {
        id: 'attachment',
        groups: ['action'],
        keywords: ['include', 'clip', 'paperclip', 'file'],
        name: 'Attachment',
        defaultProps: {},
      },
      {
        id: 'location',
        groups: ['action'],
        keywords: ['pin', 'position', 'map', 'gps', 'place'],
        name: 'Location',
        defaultProps: {},
      },
      {
        id: 'edit',
        groups: ['action'],
        keywords: ['pencil', 'modify', 'change', 'write'],
        name: 'Edit',
        defaultProps: {},
      },
      {
        id: 'filter',
        groups: ['action'],
        keywords: ['funnel', 'search', 'refine', 'sort'],
        name: 'Filter',
        defaultProps: {},
      },
      {
        id: 'sort',
        groups: ['action'],
        keywords: ['order', 'arrange', 'organize', 'rank'],
        name: 'Sort',
        defaultProps: {
          rotated: false,
        },
      },
      {
        id: 'sort',
        groups: ['action'],
        keywords: ['order', 'arrange', 'organize', 'rank'],
        name: 'Sort',
        defaultProps: {
          rotated: true,
        },
      },
      {
        id: 'case',
        groups: ['action'],
        keywords: ['case', 'toggle', 'search', 'case sensitive', 'A', 'Aa'],
        name: 'Case',
        defaultProps: {},
      },
      {
        id: 'show',
        groups: ['action'],
        keywords: ['visible', 'eye', 'view', 'display'],
        name: 'Show',
        defaultProps: {},
      },
      {
        id: 'hide',
        groups: ['action'],
        keywords: ['invisible', 'hidden'],
        name: 'Hide',
        defaultProps: {},
      },
      {
        id: 'lock',
        name: 'Lock',
        defaultProps: {
          locked: false,
        },
      },
      {
        id: 'lock-isSolid',
        name: 'Lock',
        defaultProps: {
          locked: true,
        },
      },
      {
        id: 'grabbable',
        groups: ['action'],
        keywords: ['move', 'arrange', 'organize', 'rank', 'switch', 'drag', 'handle'],
        name: 'Grabbable',
        defaultProps: {},
      },
      {
        id: 'ellipsis',
        groups: ['action'],
        keywords: ['expand', 'open', 'more', 'hidden', 'dots', 'menu'],
        name: 'Ellipsis',
        defaultProps: {},
      },
      {
        id: 'megaphone',
        groups: ['action'],
        keywords: ['speaker', 'announce', 'bullhorn', 'broadcast'],
        name: 'Megaphone',
        defaultProps: {},
      },
      {
        id: 'question',
        groups: ['action'],
        keywords: ['info', 'about', 'information', 'ask', 'faq', 'q&a'],
        name: 'Question',
        defaultProps: {},
      },
      {
        id: 'info',
        groups: ['action'],
        keywords: ['more', 'about', 'information', 'ask', 'faq', 'q&a'],
        name: 'Info',
        defaultProps: {},
      },
      {
        id: 'user',
        groups: ['action'],
        keywords: ['person', 'portrait', 'profile', 'account'],
        name: 'User',
        defaultProps: {},
      },
      {
        id: 'chat',
        groups: ['action', 'action'],
        keywords: ['message', 'bubble', 'talk', 'conversation'],
        name: 'Chat',
        defaultProps: {},
      },
      {
        id: 'clock',
        groups: ['action'],
        keywords: ['time', 'watch', 'schedule', 'hour'],
        name: 'Clock',
        defaultProps: {},
      },
      {
        id: 'sliders',
        name: 'Sliders',
        defaultProps: {},
      },
      {
        id: 'fix',
        groups: ['action'],
        keywords: ['wrench', 'resolve', 'repair', 'tool'],
        name: 'Fix',
        defaultProps: {},
      },
      {
        id: 'tag',
        groups: ['action'],
        keywords: ['price', 'category', 'group', 'label', 'organize'],
        name: 'Tag',
        defaultProps: {},
      },
      {
        id: 'moon',
        groups: ['action'],
        keywords: ['dark', 'night', 'theme', 'mode'],
        name: 'Moon',
        defaultProps: {},
      },
      {
        id: 'subscribed',
        groups: ['action'],
        keywords: ['alert', 'notification', 'subscribe', 'bell', 'ring', 'enabled'],
        name: 'Subscribed',
        defaultProps: {},
      },
      {
        id: 'unsubscribed',
        groups: ['action'],
        keywords: ['alert', 'notification', 'subscribe', 'bell', 'ring', 'disabled'],
        name: 'Unsubscribed',
        defaultProps: {},
      },
      {
        id: 'sound',
        groups: ['action'],
        keywords: ['audio', 'volume', 'speaker', 'noise'],
        name: 'Sound',
        defaultProps: {},
      },
      {
        id: 'mute',
        groups: ['action'],
        keywords: ['audio', 'volume', 'silence', 'quiet'],
        name: 'Mute',
        defaultProps: {},
      },
      {
        id: 'resize',
        groups: ['action'],
        keywords: ['scale', 'stretch', 'expand', 'shrink'],
        name: 'Resize',
        defaultProps: {},
      },
      {
        id: 'expand',
        groups: ['action'],
        keywords: ['open', 'grow', 'enlarge', 'maximize'],
        name: 'Expand',
        defaultProps: {},
      },
      {
        id: 'contract',
        groups: ['action'],
        keywords: ['close', 'shrink', 'minimize', 'collapse'],
        name: 'Contract',
        defaultProps: {},
      },
      {
        id: 'group',
        groups: ['action'],
        keywords: ['users', 'person', 'people', 'team', 'collective'],
        name: 'Group',
        defaultProps: {},
      },
      {
        id: 'rewind10',
        groups: ['action'],
        keywords: ['rewind', 'back', 'replay', '10'],
        name: 'Rewind10',
        defaultProps: {},
      },
      {
        id: 'timer',
        name: 'Timer',
        defaultProps: {},
      },
      {
        id: 'cursorArrow',
        keywords: ['pointer', 'mouse'],
        name: 'CursorArrow',
        defaultProps: {},
      },
      {
        id: 'keyDown',
        keywords: ['keyboard', 'press', 'click', 'tap'],
        name: 'KeyDown',
        defaultProps: {},
      },
      {
        id: 'zoom-out',
        keywords: ['magnify', 'reduce', 'decrease', 'shrink'],
        name: 'Zoom',
        defaultProps: {isZoomIn: false},
      },
      {
        id: 'zoom-in',
        keywords: ['magnify', 'enlarge', 'increase', 'expand'],
        name: 'Zoom',
        defaultProps: {isZoomIn: true},
      },
      {
        id: 'focus',
        keywords: ['foreground'],
        name: 'Focus',
        defaultProps: {isFocused: true},
      },
      {
        id: 'blur',
        keywords: ['background'],
        name: 'Focus',
        defaultProps: {isFocused: false},
      },
      {
        id: 'tap',
        keywords: ['finger', 'hand', 'cursor'],
        name: 'Tap',
        defaultProps: {},
      },
      {
        id: 'thumb-direction-up',
        keywords: ['feedback', 'good', 'like', 'approve'],
        additionalProps: ['direction'],
        name: 'Thumb',
        defaultProps: {
          direction: 'up',
        },
      },
      {
        id: 'thumb-direction-down',
        keywords: ['feedback', 'bad', 'poor', 'dislike', 'disapprove'],
        name: 'Thumb',
        defaultProps: {
          direction: 'down',
        },
      },
    ],
  },
  {
    id: 'chart',
    label: 'Visualizations',
    icons: [
      {
        id: 'graph-type-line',
        groups: ['chart'],
        keywords: ['line', 'plot', 'chart', 'data', 'visualization'],
        additionalProps: ['type'],
        name: 'Graph',
        defaultProps: {
          type: 'line',
        },
      },
      {
        id: 'graph-type-circle',
        name: 'Graph',
        defaultProps: {
          type: 'circle',
        },
      },
      {
        id: 'graph-type-bar',
        name: 'Graph',
        defaultProps: {
          type: 'bar',
        },
      },
      {
        id: 'graph-type-area',
        name: 'Graph',
        defaultProps: {
          type: 'area',
        },
      },
      {
        id: 'graph-type-scatter',
        name: 'Graph',
        defaultProps: {
          type: 'scatter',
        },
      },
      {
        id: 'stack',
        groups: ['chart'],
        keywords: ['group', 'combine', 'view', 'layers', 'pile'],
        name: 'Stack',
        defaultProps: {},
      },
      {
        id: 'span',
        groups: ['chart'],
        keywords: ['performance', 'transaction', 'timeline', 'trace'],
        name: 'Span',
        defaultProps: {},
      },
      {
        id: 'number',
        groups: ['chart'],
        keywords: ['value', 'digit', 'metric', 'count'],
        name: 'Number',
        defaultProps: {},
      },
      {
        id: 'profiling',
        name: 'Profiling',
        defaultProps: {},
      },
      {
        id: 'table',
        keywords: ['grid', 'rows', 'columns', 'data'],
        name: 'Table',
        defaultProps: {},
      },
      {
        id: 'grid',
        name: 'Grid',
        keywords: ['squares', 'layout', 'table', 'matrix'],
        defaultProps: {},
      },
      {
        id: 'globe',
        name: 'Globe',
        keywords: ['map', 'international', 'world', 'earth'],
        defaultProps: {},
      },
    ],
  },
  {
    id: 'device',
    label: 'Device',
    icons: [
      {
        id: 'file',
        groups: ['device'],
        keywords: ['document', 'paper', 'attachment', 'data'],
        name: 'File',
        defaultProps: {},
      },
      {
        id: 'print',
        groups: ['device'],
        keywords: ['printer', 'paper', 'output', 'hardcopy'],
        name: 'Print',
        defaultProps: {},
      },
      {
        id: 'code',
        groups: ['device'],
        keywords: ['snippet', 'javascript', 'json', 'curly', 'source', 'programming'],
        name: 'Code',
        defaultProps: {},
      },
      {
        id: 'json',
        groups: ['device'],
        keywords: ['snippet', 'code', 'javascript', 'source', 'data', 'format'],
        name: 'Json',
        defaultProps: {},
      },
      {
        id: 'markdown',
        groups: ['device'],
        keywords: ['code', 'text', 'format', 'documentation'],
        name: 'Markdown',
        defaultProps: {},
      },
      {
        id: 'terminal',
        groups: ['device', 'device'],
        keywords: ['code', 'bash', 'command', 'shell', 'console'],
        name: 'Terminal',
        defaultProps: {},
      },
      {
        id: 'commit',
        groups: ['device'],
        keywords: ['git', 'github', 'version', 'save', 'repository'],
        name: 'Commit',
        defaultProps: {},
      },
      {
        id: 'mobile',
        groups: ['device'],
        keywords: ['phone', 'iphone', 'smartphone', 'cell'],
        name: 'Mobile',
        defaultProps: {},
      },
      {
        id: 'window',
        groups: ['device'],
        keywords: ['application', 'app', 'dialog', 'browser'],
        name: 'Window',
        defaultProps: {},
      },
      {
        id: 'calendar',
        groups: ['device'],
        keywords: ['time', 'date', 'schedule', 'month'],
        name: 'Calendar',
        defaultProps: {},
      },
      {
        id: 'mail',
        groups: ['device'],
        keywords: ['email', 'message', 'envelope', 'letter'],
        name: 'Mail',
        defaultProps: {},
      },
      {
        id: 'input',
        groups: ['device'],
        keywords: ['text', 'field', 'form', 'textbox'],
        name: 'Input',
        defaultProps: {},
      },
      {
        id: 'fileBroken',
        groups: ['device'],
        keywords: ['file', 'missing', 'error', 'corrupt', 'broken'],
        name: 'FileBroken',
        defaultProps: {},
      },
      {
        id: 'image',
        groups: ['device'],
        keywords: ['image', 'photo', 'screenshot', 'picture', 'media'],
        name: 'Image',
        defaultProps: {},
      },
      {
        id: 'creditCard',
        groups: ['device'],
        keywords: ['creditCard', 'card', 'payment'],
        name: 'CreditCard',
        defaultProps: {},
      },
      {
        id: 'receipt',
        groups: ['device'],
        keywords: ['receipt', 'invoice', 'payment'],
        name: 'Receipt',
        defaultProps: {},
      },
    ],
  },
];

export default function IconsStories() {
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = useQueryState(
    'search',
    parseAsString.withDefault('')
  );

  const definedWithPrefix = new Set<string>();

  SECTIONS.forEach(section =>
    section.icons.forEach(icon => definedWithPrefix.add(`Icon${icon.name}`))
  );

  const unclassifiedSection = {
    id: 'other',
    label: 'Unclassified',
    icons: Object.keys(Icons)
      .filter(name => !definedWithPrefix.has(name))
      .map((name): TIcon => ({id: name, name})),
  };

  return (
    <Fragment>
      <Text as="p" density="comfortable" size="md" variant="primary">
        In addition to icon name, you can also search by keyword. For example, both{' '}
        <Text monospace as="span">
          checkmark
        </Text>{' '}
        and{' '}
        <Text monospace as="span">
          success
        </Text>{' '}
        match{' '}
        <Text monospace as="span">
          IconCheckmark
        </Text>
        .
      </Text>
      <StyledSticky>
        <Flex padding="xl 0" direction="column" gap="lg">
          <Input
            value={searchTerm}
            placeholder="Search icons by name or keyword"
            onChange={e => setSearchTerm(e.target.value.toLowerCase())}
          />
        </Flex>
      </StyledSticky>
      <Heading as="h5" size="xl" variant="primary">
        Icon Variants
      </Heading>
      <Text as="p" density="comfortable" size="md" variant="primary">
        Just like other Core components, Icons support a set of variants that control the
        color of the icon. The full list of variants is{' '}
        {Object.keys(theme.tokens.content).map((v, idx) => (
          <Fragment key={v}>
            <InlineCode>{v}</InlineCode>
            {idx < Object.keys(theme.tokens.content).length - 1 ? ', ' : ''}
          </Fragment>
        ))}
        .
      </Text>
      <Flex direction="row" gap="md" justify="between" width="100%">
        {Object.keys(theme.tokens.content).map(v => (
          <Stack key={v} align="center" gap="md">
            <Icons.IconSentry size="md" variant={v as any} />
            <InlineCode>
              <Text size="xs" monospace>
                {v}
              </Text>
            </InlineCode>
          </Stack>
        ))}
      </Flex>
      {SECTIONS.map(section => (
        <CoreSection searchTerm={searchTerm} key={section.id} section={section} />
      ))}
      <CoreSection searchTerm={searchTerm} section={unclassifiedSection} />
      <PluginIconsSection searchTerm={searchTerm} />
      <IdentityIconsSection searchTerm={searchTerm} />
      <PlatformIconsSection searchTerm={searchTerm} />
    </Fragment>
  );
}

function PlatformIconsSection({searchTerm}: {searchTerm: string}) {
  return (
    <Section
      icons={platforms.map(platform => ({name: platform, id: platform}))}
      searchTerm={searchTerm}
      title="PlatformIcons"
      renderIcon={(icon: TIcon) => (
        <IconCard
          icon={{id: icon.id, name: 'PlatformIcon', defaultProps: {platform: icon.id}}}
          importSource="platformicons"
        >
          <PlatformIcon platform={icon.id} /> {icon.name}
        </IconCard>
      )}
    />
  );
}

const PLUGIN_ICON_KEYS: Array<PluginIconProps['pluginId']> = [
  'placeholder',
  'sentry',
  'browsers',
  'device',
  'interface_types',
  'os',
  'urls',
  'webhooks',
  'amazon-sqs',
  'aws_lambda',
  'asana',
  'bitbucket',
  'bitbucket_pipelines',
  'bitbucket_server',
  'discord',
  'github',
  'github_enterprise',
  'gitlab',
  'heroku',
  'jira',
  'jira_server',
  'jumpcloud',
  'msteams',
  'opsgenie',
  'pagerduty',
  'pivotal',
  'pushover',
  'redmine',
  'segment',
  'slack',
  'trello',
  'twilio',
  'visualstudio',
  'vsts',
  'vercel',
  'victorops',
];

const PLUGIN_ICONS = PLUGIN_ICON_KEYS.map(key => ({
  id: key,
  name: key,
  keywords: [key],
  icons: [{id: key, name: key}],
}));

function PluginIconsSection({searchTerm}: {searchTerm: string}) {
  return (
    <Section
      icons={PLUGIN_ICONS}
      searchTerm={searchTerm}
      title="PluginIcons"
      renderIcon={(icon: TIcon) => (
        <IconCard
          icon={{id: icon.id, name: 'PluginIcon', defaultProps: {pluginId: icon.id}}}
          importSource="sentry/plugins/components/pluginIcon"
        >
          <PluginIcon pluginId={icon.id} /> {icon.name}
        </IconCard>
      )}
    />
  );
}

const IDENTITY_ICON_KEYS: Array<IdentityIconProps['providerId']> = [
  'placeholder',
  'active-directory',
  'asana',
  'auth0',
  'bitbucket',
  'bitbucket_server',
  'github',
  'github_enterprise',
  'gitlab',
  'google',
  'jira_server',
  'jumpcloud',
  'msteams',
  'okta',
  'onelogin',
  'rippling',
  'saml2',
  'slack',
  'visualstudio',
  'vsts',
];

const IDENTITY_ICONS = IDENTITY_ICON_KEYS.map(key => ({
  id: key,
  name: key,
  keywords: [key],
  icons: [{id: key, name: key}],
}));

function IdentityIconsSection({searchTerm}: {searchTerm: string}) {
  return (
    <Section
      icons={IDENTITY_ICONS}
      searchTerm={searchTerm}
      title="IdentityIcons"
      renderIcon={(identity: TIcon) => (
        <IconCard
          icon={{
            id: identity.id,
            name: 'IdentityIcon',
            defaultProps: {providerId: identity.id},
          }}
          importSource="sentry/views/settings/components/identityIcon"
        >
          <IdentityIcon providerId={identity.id} /> {identity.name}
        </IconCard>
      )}
    />
  );
}

function CoreSection({section, searchTerm}: {searchTerm: string; section: TSection}) {
  const renderIcon = (icon: TIcon) => {
    const name = icon.name.startsWith('Icon') ? icon.name : `Icon${icon.name}`;
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    const Component = Icons[name];

    if (!Component) {
      // The definition is not type safe, so lets log the icon instead of throwing an error
      // eslint-disable-next-line no-console
      console.log('Missing icon', name);
      return null;
    }

    const variant = icon.defaultProps ? propsToVariant(icon.defaultProps) : null;

    const props = {...icon.defaultProps};
    return (
      <IconCard icon={icon} importSource="sentry/icons">
        <Component {...props} />
        {name}
        {variant && (
          <Text as="span" size="sm" variant="muted">
            {variant}
          </Text>
        )}
      </IconCard>
    );
  };
  return (
    <Section
      icons={section.icons}
      title={section.label}
      renderIcon={renderIcon}
      searchTerm={searchTerm}
    />
  );
}

const createIconFilter =
  (searchTerm: string) =>
  (icon: TIcon): boolean => {
    const name = fzf(icon.name, searchTerm.toLowerCase(), false);
    if (name.score > 10) {
      return true;
    }
    // Also search against the full icon name with "Icon" prefix (e.g., "IconSettings")
    const iconName = icon.name.startsWith('Icon') ? icon.name : `Icon${icon.name}`;
    const fullIconName = fzf(iconName, searchTerm.toLowerCase(), false);
    if (fullIconName.score > 10) {
      return true;
    }
    for (const keyword of icon.keywords ?? []) {
      const match = fzf(keyword, searchTerm.toLowerCase(), false);
      if (match.score > 20) {
        return true;
      }
    }
    return false;
  };

interface CategorySectionProps {
  renderIcon(icon: TIcon): React.ReactNode;
  title: string;
  icons?: TIcon[];
  searchTerm?: string;
}

function Section(props: CategorySectionProps) {
  let filteredIcons = props.icons ?? [];
  if (props.searchTerm) {
    const iconFilter = createIconFilter(props.searchTerm);
    filteredIcons = filteredIcons.filter(iconFilter);
  }
  if (filteredIcons.length === 0) return null;

  return (
    <Flex as="section" direction="column" gap="xl">
      <Container padding="xl 0 0 0">
        <Heading as="h5" size="xl" style={{scrollMarginTop: '128px'}}>
          {props.title}
        </Heading>
      </Container>
      <Grid
        columns={{xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)'}}
        align="center"
        gap="md"
      >
        {filteredIcons.map(icon => props.renderIcon(icon))}
      </Grid>
    </Flex>
  );
}

interface IconCardProps {
  children: React.ReactNode;
  icon: TIcon;
  importSource: string;
}
function IconCard(props: IconCardProps) {
  const name = props.icon.name.includes('Icon')
    ? props.icon.name
    : `Icon${props.icon.name}`;
  const shift = useKeyPress('Shift');
  const snippets = {
    all: '',
    import: `import { ${name} } from "${props.importSource}";`,
    element: `<${name}${props.icon.defaultProps ? ` ${serializeProps(props.icon.defaultProps)}` : ''} />`,
  };
  snippets.all = `${snippets.import}\n\n${snippets.element}`;
  const labels = {
    import: `import statement`,
    element: props.icon.id,
  };
  const action: keyof typeof snippets = shift ? 'import' : 'element';

  const {copy} = useCopyToClipboard();

  return (
    <Tooltip
      maxWidth={640}
      isHoverable
      title={
        <Stack gap="md">
          <CodeBlock language="jsx" code={snippets.all} />
          <Flex gap="lg">
            <Flex align="center" gap="sm">
              <Tag
                type={action === 'element' ? 'info' : 'default'}
                style={{width: 'max-content'}}
              >
                click
              </Tag>
              <Text
                monospace
                size="sm"
                variant={action === 'element' ? 'primary' : 'muted'}
              >
                Copy element
              </Text>
            </Flex>
            <Flex align="center" gap="sm">
              <Tag type={action === 'import' ? 'info' : 'default'}>shift+click</Tag>
              <Text
                monospace
                size="sm"
                variant={action === 'import' ? 'primary' : 'muted'}
              >
                Copy import
              </Text>
            </Flex>
          </Flex>
        </Stack>
      }
    >
      <Cell
        onClick={() =>
          copy(snippets[action], {
            successMessage: `Copied ${labels[action]} to clipboard`,
          })
        }
      >
        {props.children}
      </Cell>
    </Tooltip>
  );
}

function CodeBlock({code, language}: {code: string; language: string}) {
  const lines = usePrismTokens({code, language});
  return (
    <Pre className={`language-${language}`}>
      <code>
        {lines.map((line, lineIndex) => (
          <Line key={lineIndex}>
            {line.map((tokenProps, tokenIndex) => (
              <span key={`${lineIndex}:${tokenIndex}`} {...tokenProps} />
            ))}
          </Line>
        ))}
      </code>
    </Pre>
  );
}

function propsToVariant(props: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(props)) {
    // direct enum types
    if (['type', 'direction', 'variant'].includes(key)) {
      return typeof value === 'string' ? value : null;
    }
    // isSolid, isZoomIn
    if (key.startsWith('is') && value) {
      return lowerFirst(key.replace('is', ''));
    }
    // locked
    if (value === true) {
      return key;
    }
  }
  return null;
}

function serializeProps(props: Record<string, unknown>) {
  const output: string[] = [];
  for (const [name, value] of Object.entries(props)) {
    if (value === null || value === undefined) {
      output.push(`${name}={null}`);
    } else if (value === true) {
      output.push(name);
    } else if (value === false) {
      continue;
    } else if (typeof value === 'string') {
      output.push(`${name}=${JSON.stringify(value)}`);
    } else if (typeof value === 'number') {
      output.push(`${name}={${value}}`);
    } else if (typeof value === 'function') {
      output.push(`${name}={${value.name || 'Function'}}`);
    } else if (!isValidElement(value)) {
      output.push(`${name}={${JSON.stringify(value)}}`);
    }
  }
  return output.join(' ');
}

const StyledSticky = styled(Sticky)`
  background: ${p => p.theme.tokens.background.primary};
  z-index: ${p => p.theme.zIndex.initial};
  top: 52px;
`;

const Pre = styled('pre')`
  margin: calc(${p => p.theme.space.md} * -1) calc(${p => p.theme.space.lg} * -1);
  margin-bottom: 0;
  border-bottom-left-radius: 0 !important;
  border-bottom-right-radius: 0 !important;
`;
const Line = styled('div')`
  min-height: 1lh;
`;

const Cell = styled('button')`
  background: none;
  display: flex;
  width: 100%;
  gap: ${p => p.theme.space.md};
  align-items: center;
  border: 0;
  border-radius: ${p => p.theme.radius.md};
  padding: ${p => p.theme.space.md};
  cursor: pointer;
  text-align: left;

  &:hover {
    background: ${p => p.theme.tokens.background.secondary};
  }
`;
