import {ReactNode} from 'react';

import {Tooltip} from 'sentry/components/tooltip';
import {IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import {
  BreadcrumbFrame,
  LargestContentfulPaintFrame,
  MultiClickFrame,
  MutationFrame,
  NavFrame,
  ReplayFrame,
  SlowClickFrame,
  SpanFrame,
} from 'sentry/utils/replays/types';
import type {Color} from 'sentry/utils/theme';
import stripOrigin from 'sentry/utils/url/stripOrigin';

export function getColor(frame: ReplayFrame): Color {
  if ('category' in frame) {
    switch (frame.category) {
      case 'replay.init':
        return 'gray300';
      case 'navigation':
        return 'green300';
      case 'issue':
        return 'red300';
      case 'ui.slowClickDetected':
        return (frame as SlowClickFrame).data.endReason === 'timeout'
          ? 'red300'
          : 'yellow300';
      case 'ui.multiClick':
        return 'red300';
      case 'replay.mutations':
        return 'yellow300';
      case 'ui.click':
      case 'ui.input':
      case 'ui.keyDown':
      case 'ui.blur':
      case 'ui.focus':
        return 'purple300';
      case 'console':
      default: // Custom breadcrumbs will fall through here
        return 'gray300';
    }
  }

  switch (frame.op) {
    case 'navigation.navigate':
    case 'navigation.reload':
    case 'navigation.back_forward':
    case 'navigation.push':
      return 'green300';
    case 'largest-contentful-paint':
    case 'memory':
    case 'paint':
    case 'resource.fetch':
    case 'resource.xhr':
    default:
      return 'gray300';
  }
}

/**
 * The breadcrumbType is used as a value for <BreadcrumbIcon/>
 * We could remove the indirection by associating frames with icons directly.
 *
 * @deprecated
 */
export function getBreadcrumbType(frame: ReplayFrame): BreadcrumbType {
  if ('category' in frame) {
    switch (frame.category) {
      case 'replay.init':
        return BreadcrumbType.DEFAULT;
      case 'navigation':
        return BreadcrumbType.NAVIGATION;
      case 'issue':
        return BreadcrumbType.ERROR;
      case 'ui.slowClickDetected':
        return (frame as SlowClickFrame).data.endReason === 'timeout'
          ? BreadcrumbType.ERROR
          : BreadcrumbType.WARNING;
      case 'ui.multiClick':
        return BreadcrumbType.ERROR;
      case 'replay.mutations':
        return BreadcrumbType.WARNING;
      case 'ui.click':
      case 'ui.input':
      case 'ui.keyDown':
      case 'ui.blur':
      case 'ui.focus':
        return BreadcrumbType.UI;
      case 'console':
        return BreadcrumbType.DEBUG;
      default: // Custom breadcrumbs will fall through here
        return BreadcrumbType.DEFAULT;
    }
  }

  switch (frame.op) {
    case 'navigation.navigate':
    case 'navigation.reload':
    case 'navigation.back_forward':
    case 'navigation.push':
      return BreadcrumbType.NAVIGATION;
    case 'largest-contentful-paint':
    case 'memory':
    case 'paint':
      return BreadcrumbType.INFO;
    case 'resource.fetch':
    case 'resource.xhr':
      return BreadcrumbType.HTTP;
    default:
      return BreadcrumbType.DEFAULT;
  }
}

export function getTitle(frame: ReplayFrame): ReactNode {
  if (
    typeof frame.data === 'object' &&
    frame.data !== null &&
    'label' in frame.data &&
    frame.data.label
  ) {
    return frame.data.label; // TODO(replay): Included for backwards compat
  }

  if ('category' in frame) {
    const [type, action] = frame.category.split('.');
    switch (frame.category) {
      case 'replay.init':
        return 'Replay Init';
      case 'navigation':
        return 'Navigation';
      case 'ui.slowClickDetected':
        return (frame as SlowClickFrame).data.endReason === 'timeout'
          ? 'Dead Click'
          : 'Slow Click';
      case 'ui.multiClick':
        return 'Rage Click';
      case 'replay.mutations':
        return 'Replay';
      case 'ui.click':
      case 'ui.input':
      case 'ui.keyDown':
      case 'ui.blur':
      case 'ui.focus':
        return `User ${action || ''}`;
      default: // Custom breadcrumbs will fall through here
        return `${type} ${action || ''}`.trim();
    }
  }

  if ('message' in frame) {
    return frame.message; // TODO(replay): Included for backwards compat
  }

  switch (frame.op) {
    case 'navigation.navigate':
      return 'Page Load';
    case 'navigation.reload':
      return 'Reload';
    case 'navigation.back_forward':
      return 'Navigate Back';
    case 'navigation.push':
      return 'Navigation';
    default:
      return frame.description;
  }
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

export function getDescription(frame: ReplayFrame): ReactNode {
  if ('category' in frame) {
    switch (frame.category) {
      case 'replay.init':
        return stripOrigin(frame.message ?? '');
      case 'navigation':
        const navFrame = frame as NavFrame;
        return stripOrigin(navFrame.data.to);
      case 'issue':
      case 'ui.slowClickDetected': {
        const slowClickFrame = frame as SlowClickFrame;
        const node = slowClickFrame.data.node;
        return slowClickFrame.data.endReason === 'timeout'
          ? tct(
              'Click on [selector] did not cause a visible effect within [timeout] ms',
              {
                selector: stringifyNodeAttributes(node),
                timeout: slowClickFrame.data.timeAfterClickMs,
              }
            )
          : tct('Click on [selector] took [duration] ms to have a visible effect', {
              selector: stringifyNodeAttributes(node),
              duration: slowClickFrame.data.timeAfterClickMs,
            });
      }
      case 'ui.multiClick':
        const multiClickFrame = frame as MultiClickFrame;
        return tct('Rage clicked [clickCount] times on [selector]', {
          clickCount: multiClickFrame.data.clickCount,
          selector: stringifyNodeAttributes(multiClickFrame.data.node),
        });
      case 'replay.mutations': {
        const mutationFrame = frame as MutationFrame;
        return mutationFrame.data.limit
          ? t(
              'A large number of mutations was detected (%s). Replay is now stopped to prevent poor performance for your customer.',
              mutationFrame.data.count
            )
          : t(
              'A large number of mutations was detected (%s). This can slow down the Replay SDK and impact your customers.',
              mutationFrame.data.count
            );
      }
      case 'ui.click':
        return frame.message ?? ''; // This should be the selector
      case 'ui.input':
      case 'ui.keyDown':
      case 'ui.blur':
      case 'ui.focus':
        return t('User Action');
      case 'console':
      default: // Custom breadcrumbs will fall through here
        return frame.message ?? '';
    }
  }

  switch (frame.op) {
    case 'navigation.navigate':
    case 'navigation.reload':
    case 'navigation.back_forward':
    case 'navigation.push':
      return stripOrigin(frame.description);
    case 'largest-contentful-paint': {
      const lcpFrame = frame as LargestContentfulPaintFrame;
      if (typeof lcpFrame.data.value === 'number') {
        return `${Math.round((frame as LargestContentfulPaintFrame).data.value)}ms`;
      }
      // Included for backwards compat
      return (
        <Tooltip
          title={t(
            'This replay uses a SDK version that is subject to inaccurate LCP values. Please upgrade to the latest version for best results if you have not already done so.'
          )}
        >
          <IconWarning />
        </Tooltip>
      );
    }
    default:
      return undefined;
  }
}

export function getTabKeyForFrame(frame: BreadcrumbFrame | SpanFrame): TabKey {
  if ('category' in frame) {
    switch (frame.category) {
      case 'replay.init':
        return TabKey.CONSOLE;
      case 'navigation':
        return TabKey.NETWORK;
      case 'issue':
        return TabKey.ERRORS;
      case 'replay.mutations':
      case 'ui.click':
      case 'ui.input':
      case 'ui.keyDown':
      case 'ui.multiClick':
      case 'ui.slowClickDetected':
        return TabKey.DOM;
      case 'console':
      default: // Custom breadcrumbs will fall through here
        return TabKey.CONSOLE;
    }
  }

  switch (frame.op) {
    case 'memory':
      return TabKey.MEMORY;
    case 'navigation.navigate':
    case 'navigation.reload':
    case 'navigation.back_forward':
    case 'navigation.push':
    case 'largest-contentful-paint':
    case 'paint':
    case 'resource.fetch':
    case 'resource.xhr':
    default:
      return TabKey.NETWORK;
  }
}
