import type {ReactNode} from 'react';
import {Fragment} from 'react';

import FeatureBadge from 'sentry/components/badge/featureBadge';
import ExternalLink from 'sentry/components/links/externalLink';
import CrumbErrorTitle from 'sentry/components/replays/breadcrumbs/errorTitle';
import SelectorList from 'sentry/components/replays/breadcrumbs/selectorList';
import {Tooltip} from 'sentry/components/tooltip';
import {
  IconCursorArrow,
  IconFire,
  IconFix,
  IconInfo,
  IconInput,
  IconKeyDown,
  IconLocation,
  IconMegaphone,
  IconMobile,
  IconSort,
  IconTerminal,
  IconUser,
  IconWarning,
} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import type {
  BreadcrumbFrame,
  DeviceBatteryFrame,
  DeviceConnectivityFrame,
  DeviceOrientationFrame,
  ErrorFrame,
  FeedbackFrame,
  LargestContentfulPaintFrame,
  MultiClickFrame,
  MutationFrame,
  NavFrame,
  ReplayFrame,
  SlowClickFrame,
  TapFrame,
} from 'sentry/utils/replays/types';
import {
  getFrameOpOrCategory,
  isDeadClick,
  isDeadRageClick,
  isRageClick,
} from 'sentry/utils/replays/types';
import type {Color} from 'sentry/utils/theme';
import stripURLOrigin from 'sentry/utils/url/stripURLOrigin';

interface Details {
  color: Color;
  description: ReactNode;
  icon: ReactNode;
  tabKey: TabKey;
  title: ReactNode;
}

const MAPPER_FOR_FRAME: Record<string, (frame) => Details> = {
  'replay.init': (frame: BreadcrumbFrame) => ({
    color: 'gray300',
    description: stripURLOrigin(frame.message ?? ''),
    tabKey: TabKey.CONSOLE,
    title: 'Replay Start',
    icon: <IconTerminal size="xs" />,
  }),
  navigation: (frame: NavFrame) => ({
    color: 'green300',
    description: stripURLOrigin((frame as NavFrame).data.to),
    tabKey: TabKey.NETWORK,
    title: 'Navigation',
    icon: <IconLocation size="xs" />,
  }),
  feedback: (frame: FeedbackFrame) => ({
    color: 'pink300',
    description: frame.data.projectSlug,
    tabKey: TabKey.BREADCRUMBS,
    title: defaultTitle(frame),
    icon: <IconMegaphone size="xs" />,
  }),
  issue: (frame: ErrorFrame) => ({
    color: 'red300',
    description: frame.message,
    tabKey: TabKey.ERRORS,
    title: <CrumbErrorTitle frame={frame} />,
    icon: <IconFire size="xs" />,
  }),
  'ui.slowClickDetected': (frame: SlowClickFrame) => {
    const node = frame.data.node;
    if (isDeadClick(frame)) {
      return {
        color: isDeadRageClick(frame) ? 'red300' : 'yellow300',
        description: tct(
          'Click on [selector] did not cause a visible effect within [timeout] ms',
          {
            selector: stringifyNodeAttributes(node),
            timeout: Math.round(frame.data.timeAfterClickMs),
          }
        ),
        icon: <IconCursorArrow size="xs" />,
        title: isDeadRageClick(frame) ? 'Rage Click' : 'Dead Click',
        tabKey: TabKey.BREADCRUMBS,
      };
    }
    return {
      color: 'yellow300',
      description: tct(
        'Click on [selector] took [duration] ms to have a visible effect',
        {
          selector: stringifyNodeAttributes(node),
          duration: Math.round(frame.data.timeAfterClickMs),
        }
      ),
      icon: <IconWarning size="xs" />,
      title: 'Slow Click',
      tabKey: TabKey.BREADCRUMBS,
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
        tabKey: TabKey.BREADCRUMBS,
        title: 'Rage Click',
        icon: <IconFire size="xs" />,
      };
    }

    return {
      color: 'yellow300',
      description: tct('[clickCount] clicks on [selector]', {
        clickCount: frame.data.clickCount,
        selector: stringifyNodeAttributes(frame.data.node),
      }),
      tabKey: TabKey.BREADCRUMBS,
      title: 'Multi Click',
      icon: <IconWarning size="xs" />,
    };
  },
  'replay.mutations': (frame: MutationFrame) => ({
    color: 'yellow300',
    description: frame.data.limit
      ? tct(
          'A large number of mutations was detected [count]. Replay is now stopped to prevent poor performance for your customer. [link]',
          {
            count: frame.data.count,
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/session-replay/configuration/#mutation-limits">
                {t('Learn more.')}
              </ExternalLink>
            ),
          }
        )
      : tct(
          'A large number of mutations was detected [count]. This can slow down the Replay SDK and impact your customers. [link]',
          {
            count: frame.data.count,
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/session-replay/configuration/#mutation-limits">
                {t('Learn more.')}
              </ExternalLink>
            ),
          }
        ),
    tabKey: TabKey.BREADCRUMBS,
    title: 'Replay',
    icon: <IconWarning size="xs" />,
  }),
  'replay.hydrate-error': () => ({
    color: 'red300',
    description: t(
      'There was a conflict between the server rendered html and the first client render.'
    ),
    tabKey: TabKey.BREADCRUMBS,
    title: (
      <Fragment>
        Hydration Error <FeatureBadge type="beta" />
      </Fragment>
    ),
    icon: <IconFire size="xs" />,
  }),
  'ui.click': frame => ({
    color: 'blue300',
    description: <SelectorList frame={frame} />,
    tabKey: TabKey.BREADCRUMBS,
    title: 'User Click',
    icon: <IconCursorArrow size="xs" />,
  }),
  'ui.tap': (frame: TapFrame) => ({
    color: 'blue300',
    description: frame.message,
    tabKey: TabKey.BREADCRUMBS,
    title: 'User Tap',
    icon: <IconUser size="xs" />,
  }),
  'ui.input': () => ({
    color: 'blue300',
    description: 'User Action',
    tabKey: TabKey.BREADCRUMBS,
    title: 'User Input',
    icon: <IconInput size="xs" />,
  }),
  'ui.keyDown': () => ({
    color: 'blue300',
    description: 'User Action',
    tabKey: TabKey.BREADCRUMBS,
    title: 'User KeyDown',
    icon: <IconKeyDown size="xs" />,
  }),
  'ui.blur': () => ({
    color: 'blue300',
    description: 'User Action',
    tabKey: TabKey.BREADCRUMBS,
    title: 'User Blur',
    icon: <IconUser size="xs" />,
  }),
  'ui.focus': () => ({
    color: 'blue300',
    description: 'User Action',
    tabKey: TabKey.BREADCRUMBS,
    title: 'User Focus',
    icon: <IconUser size="xs" />,
  }),
  console: frame => ({
    color: 'gray300',
    description: frame.message ?? '',
    tabKey: TabKey.CONSOLE,
    title: 'Console',
    icon: <IconFix size="xs" />,
  }),
  'navigation.navigate': frame => ({
    color: 'green300',
    description: stripURLOrigin(frame.description),
    tabKey: TabKey.NETWORK,
    title: 'Page Load',
    icon: <IconLocation size="xs" />,
  }),
  'navigation.reload': frame => ({
    color: 'green300',
    description: stripURLOrigin(frame.description),
    tabKey: TabKey.NETWORK,
    title: 'Reload',
    icon: <IconLocation size="xs" />,
  }),
  'navigation.back_forward': frame => ({
    color: 'green300',
    description: stripURLOrigin(frame.description),
    tabKey: TabKey.NETWORK,
    title: 'Navigate Back/Forward',
    icon: <IconLocation size="xs" />,
  }),
  'navigation.push': frame => ({
    color: 'green300',
    description: stripURLOrigin(frame.description),
    tabKey: TabKey.NETWORK,
    title: 'Navigation',
    icon: <IconLocation size="xs" />,
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
    icon: <IconInfo size="xs" />,
  }),
  memory: () => ({
    color: 'gray300',
    description: undefined,
    tabKey: TabKey.MEMORY,
    title: 'Memory',
    icon: <IconInfo size="xs" />,
  }),
  paint: () => ({
    color: 'gray300',
    description: undefined,
    tabKey: TabKey.NETWORK,
    title: 'Paint',
    icon: <IconInfo size="xs" />,
  }),
  'resource.css': frame => ({
    color: 'gray300',
    description: undefined,
    tabKey: TabKey.NETWORK,
    title: frame.description,
    icon: <IconSort size="xs" rotated />,
  }),
  'resource.fetch': frame => ({
    color: 'gray300',
    description: undefined,
    tabKey: TabKey.NETWORK,
    title: frame.description,
    icon: <IconSort size="xs" rotated />,
  }),
  'resource.iframe': frame => ({
    color: 'gray300',
    description: undefined,
    tabKey: TabKey.NETWORK,
    title: frame.description,
    icon: <IconSort size="xs" rotated />,
  }),
  'resource.img': frame => ({
    color: 'gray300',
    description: undefined,
    tabKey: TabKey.NETWORK,
    title: frame.description,
    icon: <IconSort size="xs" rotated />,
  }),
  'resource.link': frame => ({
    color: 'gray300',
    description: undefined,
    tabKey: TabKey.NETWORK,
    title: frame.description,
    icon: <IconSort size="xs" rotated />,
  }),
  'resource.other': frame => ({
    color: 'gray300',
    description: undefined,
    tabKey: TabKey.NETWORK,
    title: frame.description,
    icon: <IconSort size="xs" rotated />,
  }),
  'resource.script': frame => ({
    color: 'gray300',
    description: undefined,
    tabKey: TabKey.NETWORK,
    title: frame.description,
    icon: <IconSort size="xs" rotated />,
  }),
  'resource.xhr': frame => ({
    color: 'gray300',
    description: undefined,
    tabKey: TabKey.NETWORK,
    title: frame.description,
    icon: <IconSort size="xs" rotated />,
  }),
  'resource.http': frame => ({
    color: 'gray300',
    description: undefined,
    tabKey: TabKey.NETWORK,
    title: frame.description,
    icon: <IconSort size="xs" rotated />,
  }),
  'device.connectivity': (frame: DeviceConnectivityFrame) => ({
    color: 'pink300',
    description: frame.data.state,
    tabKey: TabKey.BREADCRUMBS,
    title: 'Device Connectivity',
    icon: <IconMobile size="xs" />,
  }),
  'device.battery': (frame: DeviceBatteryFrame) => ({
    color: 'pink300',
    description: tct('Device was at [percent]% battery and [charging]', {
      percent: frame.data.level,
      charging: frame.data.charging ? 'charging' : 'not charging',
    }),
    tabKey: TabKey.BREADCRUMBS,
    title: 'Device Battery',
    icon: <IconMobile size="xs" />,
  }),
  'device.orientation': (frame: DeviceOrientationFrame) => ({
    color: 'pink300',
    description: frame.data.position,
    tabKey: TabKey.BREADCRUMBS,
    title: 'Device Orientation',
    icon: <IconMobile size="xs" />,
  }),
};

const MAPPER_DEFAULT = (frame): Details => ({
  color: 'gray300',
  description: frame.message ?? '',
  tabKey: TabKey.CONSOLE,
  title: defaultTitle(frame),
  icon: <IconTerminal size="xs" />,
});

export default function getFrameDetails(frame: ReplayFrame): Details {
  const key = getFrameOpOrCategory(frame);
  const fn = MAPPER_FOR_FRAME[key] ?? MAPPER_DEFAULT;
  try {
    return fn(frame);
  } catch (error) {
    return MAPPER_DEFAULT(frame);
  }
}

function defaultTitle(frame: ReplayFrame) {
  // Override title for User Feedback frames
  if ('message' in frame && frame.message === 'User Feedback') {
    return t('User Feedback');
  }
  if ('category' in frame) {
    const [type, action] = frame.category.split('.');
    return `${type} ${action || ''}`.trim();
  }
  if ('message' in frame) {
    return frame.message as string; // TODO(replay): Included for backwards compat
  }
  return frame.description ?? '';
}

function stringifyNodeAttributes(node: SlowClickFrame['data']['node']) {
  const {tagName, attributes} = node ?? {};
  const attributesEntries = Object.entries(attributes ?? {});
  const componentName = node?.attributes['data-sentry-component'];

  return `${componentName ?? tagName}${
    attributesEntries.length
      ? attributesEntries
          .map(([attr, val]) =>
            componentName && attr === 'data-sentry-component' ? '' : `[${attr}="${val}"]`
          )
          .join('')
      : ''
  }`;
}
