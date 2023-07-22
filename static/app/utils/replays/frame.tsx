import {ReactNode} from 'react';

import {Tooltip} from 'sentry/components/tooltip';
import {IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import type {
  BreadcrumbFrame,
  ErrorFrame,
  LargestContentfulPaintFrame,
  MultiClickFrame,
  MutationFrame,
  NavFrame,
  ReplayFrame,
  SlowClickFrame,
} from 'sentry/utils/replays/types';
import {
  getFrameOpOrCategory,
  isDeadClick,
  isDeadRageClick,
  isRageClick,
} from 'sentry/utils/replays/types';
import type {Color} from 'sentry/utils/theme';
import stripOrigin from 'sentry/utils/url/stripOrigin';

interface Details {
  color: Color;
  description: ReactNode;
  tabKey: TabKey;
  title: ReactNode;
  type: BreadcrumbType; // @deprecated
}

const MAPPER_FOR_FRAME: Record<string, (frame) => Details> = {
  'replay.init': (frame: BreadcrumbFrame) => ({
    color: 'gray300',
    description: stripOrigin(frame.message ?? ''),
    tabKey: TabKey.CONSOLE,
    title: 'Replay Start',
    type: BreadcrumbType.DEFAULT,
  }),
  navigation: (frame: NavFrame) => ({
    color: 'green300',
    description: stripOrigin((frame as NavFrame).data.to),
    tabKey: TabKey.NETWORK,
    title: 'Navigation',
    type: BreadcrumbType.NAVIGATION,
  }),
  issue: (frame: ErrorFrame) => ({
    color: 'red300',
    description: frame.message,
    tabKey: TabKey.ERRORS,
    title: defaultTitle(frame),
    type: BreadcrumbType.ERROR,
  }),
  'ui.slowClickDetected': (frame: SlowClickFrame) => {
    const node = frame.data.node;
    if (isDeadClick(frame)) {
      return {
        color: 'red300',
        description: tct(
          'Click on [selector] did not cause a visible effect within [timeout] ms',
          {
            selector: stringifyNodeAttributes(node),
            timeout: frame.data.timeAfterClickMs,
          }
        ),
        type: BreadcrumbType.ERROR,
        title: isDeadRageClick(frame) ? 'Rage Click' : 'Dead Click',
        tabKey: TabKey.DOM,
      };
    }
    return {
      color: 'yellow300',
      description: tct(
        'Click on [selector] took [duration] ms to have a visible effect',
        {
          selector: stringifyNodeAttributes(node),
          duration: frame.data.timeAfterClickMs,
        }
      ),
      type: BreadcrumbType.WARNING,
      title: 'Slow Click',
      tabKey: TabKey.DOM,
    };
  },
  'ui.multiClick': (frame: MultiClickFrame) => {
    if (isRageClick(frame)) {
      return {
        color: 'red300',
        description: tct('Rage clicked [clickCount] times on [selector]', {
          clickCount: frame.data.clickCount,
          selector: stringifyNodeAttributes(frame.data.node),
        }),
        tabKey: TabKey.DOM,
        title: 'Rage Click',
        type: BreadcrumbType.ERROR,
      };
    }

    return {
      color: 'yellow300',
      description: tct('[clickCount] clicks on [selector]', {
        clickCount: frame.data.clickCount,
        selector: stringifyNodeAttributes(frame.data.node),
      }),
      tabKey: TabKey.DOM,
      title: 'Multi Click',
      type: BreadcrumbType.WARNING,
    };
  },
  'replay.mutations': (frame: MutationFrame) => ({
    color: 'yellow300',
    description: frame.data.limit
      ? t(
          'A large number of mutations was detected (%s). Replay is now stopped to prevent poor performance for your customer.',
          frame.data.count
        )
      : t(
          'A large number of mutations was detected (%s). This can slow down the Replay SDK and impact your customers.',
          frame.data.count
        ),
    tabKey: TabKey.DOM,
    title: 'Replay',
    type: BreadcrumbType.WARNING,
  }),
  'ui.click': frame => ({
    color: 'gray300',
    description: frame.message ?? '',
    tabKey: TabKey.DOM,
    title: 'User Click',
    type: BreadcrumbType.UI,
  }),
  'ui.input': () => ({
    color: 'gray300',
    description: 'User Action',
    tabKey: TabKey.DOM,
    title: 'User Input',
    type: BreadcrumbType.UI,
  }),
  'ui.keyDown': () => ({
    color: 'gray300',
    description: 'User Action',
    tabKey: TabKey.DOM,
    title: 'User KeyDown',
    type: BreadcrumbType.UI,
  }),
  'ui.blur': () => ({
    color: 'gray300',
    description: 'User Action',
    tabKey: TabKey.DOM,
    title: 'User Blur',
    type: BreadcrumbType.UI,
  }),
  'ui.focus': () => ({
    color: 'purple300',
    description: 'User Action',
    tabKey: TabKey.DOM,
    title: 'User Focus',
    type: BreadcrumbType.UI,
  }),
  console: frame => ({
    color: 'gray300',
    description: frame.message ?? '',
    tabKey: TabKey.CONSOLE,
    title: 'Console',
    type: BreadcrumbType.DEBUG,
  }),
  'navigation.navigate': frame => ({
    color: 'gray300',
    description: stripOrigin(frame.description),
    tabKey: TabKey.NETWORK,
    title: 'Page Load',
    type: BreadcrumbType.NAVIGATION,
  }),
  'navigation.reload': frame => ({
    color: 'gray300',
    description: stripOrigin(frame.description),
    tabKey: TabKey.NETWORK,
    title: 'Reload',
    type: BreadcrumbType.NAVIGATION,
  }),
  'navigation.back_forward': frame => ({
    color: 'gray300',
    description: stripOrigin(frame.description),
    tabKey: TabKey.NETWORK,
    title: 'Navigate Back',
    type: BreadcrumbType.NAVIGATION,
  }),
  'navigation.push': frame => ({
    color: 'green300',
    description: stripOrigin(frame.description),
    tabKey: TabKey.NETWORK,
    title: 'Navigation',
    type: BreadcrumbType.NAVIGATION,
  }),
  'largest-contentful-paint': (frame: LargestContentfulPaintFrame) => ({
    color: 'gray300',
    description:
      typeof frame.data.value === 'number' ? (
        `${Math.round(frame.data.value)}ms`
      ) : (
        <Tooltip
          title={t(
            'This replay uses a SDK version that is subject to inaccurate LCP values. Please upgrade to the latest version for best results if you have not already done so.'
          )}
        >
          <IconWarning />
        </Tooltip>
      ),
    tabKey: TabKey.NETWORK,
    title: 'LCP',
    type: BreadcrumbType.INFO,
  }),
  memory: () => ({
    color: 'gray300',
    description: undefined,
    tabKey: TabKey.MEMORY,
    title: 'Memory',
    type: BreadcrumbType.INFO,
  }),
  paint: () => ({
    color: 'gray300',
    description: undefined,
    tabKey: TabKey.NETWORK,
    title: 'Paint',
    type: BreadcrumbType.INFO,
  }),
  'resource.fetch': frame => ({
    color: 'gray300',
    description: undefined,
    tabKey: TabKey.NETWORK,
    title: frame.description,
    type: BreadcrumbType.HTTP,
  }),
  'resource.xhr': frame => ({
    color: 'gray300',
    description: undefined,
    tabKey: TabKey.NETWORK,
    title: frame.description,
    type: BreadcrumbType.HTTP,
  }),
};

const MAPPER_DEFAULT = frame => ({
  color: 'gray300',
  description: frame.message ?? '',
  tabKey: TabKey.CONSOLE,
  title: defaultTitle(frame),
  type: BreadcrumbType.DEFAULT,
});

export function getDetails(frame: ReplayFrame): Details {
  const key = getFrameOpOrCategory(frame);
  const fn = MAPPER_FOR_FRAME[key] ?? MAPPER_DEFAULT;
  return fn(frame);
}

function defaultTitle(frame: ReplayFrame) {
  if ('category' in frame) {
    const [type, action] = frame.category.split('.');
    return `${type} ${action || ''}`.trim();
  }
  if ('message' in frame) {
    return frame.message as string; // TODO(replay): Included for backwards compat
  }
  return frame.description;
}

function stringifyNodeAttributes(node: SlowClickFrame['data']['node']) {
  const {tagName, attributes} = node ?? {};
  const attributesEntries = Object.entries(attributes ?? {});
  return `${tagName}${
    attributesEntries.length
      ? attributesEntries.map(([attr, val]) => `[${attr}="${val}"]`).join('')
      : ''
  }`;
}
