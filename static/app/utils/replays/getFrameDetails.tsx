import {Fragment, type ReactNode} from 'react';

import {Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import QuestionTooltip from 'sentry/components/questionTooltip';
import CrumbErrorTitle from 'sentry/components/replays/breadcrumbs/errorTitle';
import SelectorList from 'sentry/components/replays/breadcrumbs/selectorList';
import {
  IconCursorArrow,
  IconFire,
  IconFix,
  IconFocus,
  IconHappy,
  IconInfo,
  IconInput,
  IconKeyDown,
  IconLightning,
  IconLocation,
  IconMegaphone,
  IconMeh,
  IconRefresh,
  IconSad,
  IconSort,
  IconTap,
  IconTerminal,
  IconWarning,
  IconWifi,
} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {explodeSlug} from 'sentry/utils';
import {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import type {
  BreadcrumbFrame,
  ClickFrame,
  ConsoleFrame,
  DeviceBatteryFrame,
  DeviceConnectivityFrame,
  DeviceOrientationFrame,
  ErrorFrame,
  FeedbackFrame,
  MultiClickFrame,
  MutationFrame,
  NavFrame,
  NavigationFrame,
  RawBreadcrumbFrame,
  ReplayFrame,
  RequestFrame,
  ResourceFrame,
  ScrollFrame,
  SlowClickFrame,
  SwipeFrame,
  TapFrame,
  WebVitalFrame,
} from 'sentry/utils/replays/types';
import {
  getFrameOpOrCategory,
  isCLSFrame,
  isDeadClick,
  isDeadRageClick,
  isRageClick,
} from 'sentry/utils/replays/types';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import type {GraphicsVariant} from 'sentry/utils/theme';
import stripURLOrigin from 'sentry/utils/url/stripURLOrigin';
import {MODULE_DOC_LINK} from 'sentry/views/insights/browser/webVitals/settings';

interface Details {
  colorGraphicsToken: GraphicsVariant;
  description: ReactNode;
  icon: ReactNode;
  tabKey: TabKey;
  title: ReactNode;
}

const DEVICE_CONNECTIVITY_MESSAGE: Record<string, string> = {
  wifi: t('Device connected to wifi'),
  offline: t('Internet connection was lost'),
  cellular: t('Device connected to cellular network'),
  ethernet: t('Device connected to ethernet'),
};

const MAPPER_FOR_FRAME: Record<string, (frame: any) => Details> = {
  'replay.init': (frame: BreadcrumbFrame) => ({
    colorGraphicsToken: 'neutral',
    description: stripURLOrigin(frame.message ?? ''),
    tabKey: TabKey.CONSOLE,
    title: 'Replay Start',
    icon: <IconInfo size="xs" />,
  }),
  navigation: (frame: NavFrame) => ({
    colorGraphicsToken: 'success',
    description: stripURLOrigin(frame.data.to),
    tabKey: TabKey.NETWORK,
    title: 'Navigation',
    icon: <IconLocation size="xs" />,
  }),
  feedback: (frame: FeedbackFrame) => ({
    colorGraphicsToken: 'promotion',
    description: frame.message,
    tabKey: TabKey.BREADCRUMBS,
    title: defaultTitle(frame),
    icon: <IconMegaphone size="xs" />,
  }),
  issue: (frame: ErrorFrame) => ({
    colorGraphicsToken: 'danger',
    description: frame.message,
    tabKey: TabKey.ERRORS,
    title: <CrumbErrorTitle frame={frame} />,
    icon: <IconFire size="xs" />,
  }),
  'ui.slowClickDetected': (frame: SlowClickFrame) => {
    const node = frame.data.node;
    if (isDeadClick(frame)) {
      return {
        colorGraphicsToken: isDeadRageClick(frame) ? 'danger' : 'warning',
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
      colorGraphicsToken: 'warning',
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
        colorGraphicsToken: 'danger',
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
      colorGraphicsToken: 'warning',
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
    colorGraphicsToken: 'warning',
    description: frame.data.limit
      ? tct(
          'Significant mutations detected: [count]. Replay is now stopped to prevent poor performance for your customer. [link]',
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
          'Significant mutations detected: [count]. This can slow down the Replay SDK, impacting your customers. [link]',
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
    title: 'DOM Mutations',
    icon: <IconWarning size="xs" />,
  }),
  'replay.hydrate-error': () => ({
    colorGraphicsToken: 'danger',
    description: t(
      'There was a conflict between the server rendered html and the first client render.'
    ),
    tabKey: TabKey.BREADCRUMBS,
    title: 'Hydration Error',
    icon: <IconFire size="xs" />,
  }),
  'ui.click': (frame: ClickFrame) => ({
    colorGraphicsToken: 'accent',
    description: <SelectorList frame={frame} />,
    tabKey: TabKey.BREADCRUMBS,
    title: 'User Click',
    icon: <IconCursorArrow size="xs" />,
  }),
  'ui.swipe': (frame: SwipeFrame) => ({
    colorGraphicsToken: 'accent',
    description: frame.data,
    tabKey: TabKey.BREADCRUMBS,
    title: 'User Swipe',
    icon: <IconTap size="xs" />,
  }),
  'ui.scroll': (frame: ScrollFrame) => ({
    colorGraphicsToken: 'accent',
    description: frame.data,
    tabKey: TabKey.BREADCRUMBS,
    title: 'User Scroll',
    icon: <IconTap size="xs" />,
  }),
  'ui.tap': (frame: TapFrame) => ({
    colorGraphicsToken: 'accent',
    description: frame.message,
    tabKey: TabKey.BREADCRUMBS,
    title: 'User Tap',
    icon: <IconTap size="xs" />,
  }),
  'ui.input': () => ({
    colorGraphicsToken: 'accent',
    description: t('User Action'),
    tabKey: TabKey.BREADCRUMBS,
    title: 'User Input',
    icon: <IconInput size="xs" />,
  }),
  'ui.keyDown': () => ({
    colorGraphicsToken: 'accent',
    description: t('User Action'),
    tabKey: TabKey.BREADCRUMBS,
    title: 'User KeyDown',
    icon: <IconKeyDown size="xs" />,
  }),
  'ui.blur': () => ({
    colorGraphicsToken: 'accent',
    description: t('The user is preoccupied with another browser, tab, or window'),
    tabKey: TabKey.BREADCRUMBS,
    title: 'Window Blur',
    icon: <IconFocus isFocused={false} size="xs" />,
  }),
  'ui.focus': () => ({
    colorGraphicsToken: 'accent',
    description: t('The user is currently focused on your application,'),
    tabKey: TabKey.BREADCRUMBS,
    title: 'Window Focus',
    icon: <IconFocus size="xs" />,
  }),
  'app.foreground': () => ({
    colorGraphicsToken: 'accent',
    description: t('The user is currently focused on your application'),
    tabKey: TabKey.BREADCRUMBS,
    title: 'App in Foreground',
    icon: <IconFocus size="xs" />,
  }),
  'app.background': () => ({
    colorGraphicsToken: 'accent',
    description: t('The user is preoccupied with another app or activity'),
    tabKey: TabKey.BREADCRUMBS,
    title: 'App in Background',
    icon: <IconFocus isFocused={false} size="xs" />,
  }),
  console: (frame: ConsoleFrame) => ({
    colorGraphicsToken: 'neutral',
    description: frame.message ?? '',
    tabKey: TabKey.CONSOLE,
    title: 'Console',
    icon: <IconFix size="xs" />,
  }),
  'navigation.navigate': (frame: NavigationFrame) => ({
    colorGraphicsToken: 'success',
    description: stripURLOrigin(frame.description),
    tabKey: TabKey.NETWORK,
    title: 'Page Load',
    icon: <IconLocation size="xs" />,
  }),
  'navigation.reload': (frame: NavigationFrame) => ({
    colorGraphicsToken: 'success',
    description: stripURLOrigin(frame.description),
    tabKey: TabKey.NETWORK,
    title: 'Reload',
    icon: <IconLocation size="xs" />,
  }),
  'navigation.back_forward': (frame: NavigationFrame) => ({
    colorGraphicsToken: 'success',
    description: stripURLOrigin(frame.description),
    tabKey: TabKey.NETWORK,
    title: 'Navigate Back/Forward',
    icon: <IconLocation size="xs" />,
  }),
  'navigation.push': (frame: NavigationFrame) => ({
    colorGraphicsToken: 'success',
    description: stripURLOrigin(frame.description),
    tabKey: TabKey.NETWORK,
    title: 'Navigation',
    icon: <IconLocation size="xs" />,
  }),
  'web-vital': (frame: WebVitalFrame) => {
    switch (frame.data.rating) {
      case 'good':
        return {
          colorGraphicsToken: 'success',
          description: tct('[value][unit] (Good)', {
            value: frame.data.value.toFixed(2),
            unit: isCLSFrame(frame) ? '' : 'ms',
          }),
          tabKey: TabKey.NETWORK,
          title: WebVitalTitle(frame),
          icon: <IconHappy size="xs" />,
        };
      case 'needs-improvement':
        return {
          colorGraphicsToken: 'warning',
          description: tct('[value][unit] (Meh)', {
            value: frame.data.value.toFixed(2),
            unit: isCLSFrame(frame) ? '' : 'ms',
          }),
          tabKey: TabKey.NETWORK,
          title: WebVitalTitle(frame),
          icon: <IconMeh size="xs" />,
        };
      default:
        return {
          colorGraphicsToken: 'danger',
          description: tct('[value][unit] (Poor)', {
            value: frame.data.value.toFixed(2),
            unit: isCLSFrame(frame) ? '' : 'ms',
          }),
          tabKey: TabKey.NETWORK,
          title: WebVitalTitle(frame),
          icon: <IconSad size="xs" />,
        };
    }
  },
  memory: () => ({
    colorGraphicsToken: 'neutral',
    description: undefined,
    tabKey: TabKey.MEMORY,
    title: 'Memory',
    icon: <IconInfo size="xs" />,
  }),
  paint: () => ({
    colorGraphicsToken: 'neutral',
    description: undefined,
    tabKey: TabKey.NETWORK,
    title: 'Paint',
    icon: <IconInfo size="xs" />,
  }),
  'resource.css': (frame: ResourceFrame) => ({
    colorGraphicsToken: 'neutral',
    description: undefined,
    tabKey: TabKey.NETWORK,
    title: frame.description,
    icon: <IconSort size="xs" rotated />,
  }),
  'resource.fetch': (frame: RequestFrame) => ({
    colorGraphicsToken: 'neutral',
    description: undefined,
    tabKey: TabKey.NETWORK,
    title: frame.description,
    icon: <IconSort size="xs" rotated />,
  }),
  'resource.iframe': (frame: ResourceFrame) => ({
    colorGraphicsToken: 'neutral',
    description: undefined,
    tabKey: TabKey.NETWORK,
    title: frame.description,
    icon: <IconSort size="xs" rotated />,
  }),
  'resource.img': (frame: ResourceFrame) => ({
    colorGraphicsToken: 'neutral',
    description: undefined,
    tabKey: TabKey.NETWORK,
    title: frame.description,
    icon: <IconSort size="xs" rotated />,
  }),
  'resource.link': (frame: ResourceFrame) => ({
    colorGraphicsToken: 'neutral',
    description: undefined,
    tabKey: TabKey.NETWORK,
    title: frame.description,
    icon: <IconSort size="xs" rotated />,
  }),
  'resource.other': (frame: ResourceFrame) => ({
    colorGraphicsToken: 'neutral',
    description: undefined,
    tabKey: TabKey.NETWORK,
    title: frame.description,
    icon: <IconSort size="xs" rotated />,
  }),
  'resource.script': (frame: ResourceFrame) => ({
    colorGraphicsToken: 'neutral',
    description: undefined,
    tabKey: TabKey.NETWORK,
    title: frame.description,
    icon: <IconSort size="xs" rotated />,
  }),
  'resource.xhr': (frame: RequestFrame) => ({
    colorGraphicsToken: 'neutral',
    description: undefined,
    tabKey: TabKey.NETWORK,
    title: frame.description,
    icon: <IconSort size="xs" rotated />,
  }),
  'resource.http': (frame: RequestFrame) => ({
    colorGraphicsToken: 'neutral',
    description: undefined,
    tabKey: TabKey.NETWORK,
    title: frame.description,
    icon: <IconSort size="xs" rotated />,
  }),
  'device.connectivity': (frame: DeviceConnectivityFrame) => ({
    colorGraphicsToken: 'promotion',
    description: DEVICE_CONNECTIVITY_MESSAGE[frame.data.state],
    tabKey: TabKey.BREADCRUMBS,
    title: 'Device Connectivity',
    icon: <IconWifi size="xs" />,
  }),
  'device.battery': (frame: DeviceBatteryFrame) => ({
    colorGraphicsToken: 'promotion',
    description: tct('Device was at [percent]% battery and [charging]', {
      percent: Math.round(frame.data.level),
      charging: frame.data.charging ? 'charging' : 'not charging',
    }),
    tabKey: TabKey.BREADCRUMBS,
    title: 'Device Battery',
    icon: <IconLightning size="xs" />,
  }),
  'device.orientation': (frame: DeviceOrientationFrame) => ({
    colorGraphicsToken: 'promotion',
    description: tct('Device orientation was changed to [orientation]', {
      orientation: frame.data.position,
    }),
    tabKey: TabKey.BREADCRUMBS,
    title: 'Device Orientation',
    icon: <IconRefresh size="xs" />,
  }),
};

const MAPPER_DEFAULT = (frame: any): Details => ({
  colorGraphicsToken: 'neutral',
  description: frame.message ?? frame.data ?? '',
  tabKey: TabKey.BREADCRUMBS,
  title: toTitleCase(defaultTitle(frame)),
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

export function defaultTitle(frame: ReplayFrame | RawBreadcrumbFrame) {
  // Override title for User Feedback frames
  if (
    'message' in frame &&
    typeof frame.message === 'string' &&
    frame.category === 'feedback'
  ) {
    return t('User Feedback');
  }
  if ('category' in frame && frame.category) {
    const [type, action] = frame.category.split('.');
    return `${type} ${action || ''}`.trim();
  }
  if ('message' in frame && frame.message) {
    return frame.message; // TODO(replay): Included for backwards compat
  }
  return 'description' in frame ? (frame.description ?? '') : '';
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

function WebVitalTitle(frame: WebVitalFrame) {
  const vitalDefinition = function () {
    switch (frame.description) {
      case 'cumulative-layout-shift':
        return 'Cumulative Layout Shift (CLS) is the sum of individual layout shift scores for every unexpected element shift during the rendering process. ';
      case 'interaction-to-next-paint':
        return "Interaction to Next Paint (INP) is a metric that assesses a page's overall responsiveness to user interactions by observing the latency of all user interactions that occur throughout the lifespan of a user's visit to a page. ";
      case 'largest-contentful-paint':
        return 'Largest Contentful Paint (LCP) measures the render time for the largest content to appear in the viewport. ';
      default:
        return '';
    }
  };
  return (
    <Flex align="center" gap="xs">
      {t('Web Vital: ') + toTitleCase(explodeSlug(frame.description))}
      <QuestionTooltip
        isHoverable
        size="xs"
        title={
          <Fragment>
            {vitalDefinition()}
            <ExternalLink href={`${MODULE_DOC_LINK}/web-vitals-concepts/`}>
              {t('Learn more about web vitals here.')}
            </ExternalLink>
          </Fragment>
        }
      />
    </Flex>
  );
}
