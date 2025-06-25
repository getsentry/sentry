// eslint-disable-next-line boundaries/element-types
import HookStore from 'sentry/stores/hookStore';

import type {
  DO_NOT_USE_ButtonProps as ButtonProps,
  DO_NOT_USE_LinkButtonProps as LinkButtonProps,
} from './types';

export function useButtonFunctionality(props: ButtonProps | LinkButtonProps) {
  // Fallbacking aria-label to string children is not necessary as screen
  // readers natively understand that scenario. Leaving it here for a bunch of
  // our tests that query by aria-label.
  const accessibleLabel =
    props['aria-label'] ??
    (typeof props.children === 'string' ? props.children : undefined);

  const useButtonTrackingLogger = () => {
    const hasAnalyticsDebug = window.localStorage?.getItem('DEBUG_ANALYTICS') === '1';
    const hasCustomAnalytics =
      props.analyticsEventName || props.analyticsEventKey || props.analyticsParams;
    if (!hasCustomAnalytics || !hasAnalyticsDebug) {
      return () => {};
    }

    return () => {
      // eslint-disable-next-line no-console
      console.log('buttonAnalyticsEvent', {
        eventKey: props.analyticsEventKey,
        eventName: props.analyticsEventName,
        priority: props.priority,
        href: 'href' in props ? props.href : undefined,
        ...props.analyticsParams,
      });
    };
  };

  const useButtonTracking =
    HookStore.get('react-hook:use-button-tracking')[0] ?? useButtonTrackingLogger;

  const buttonTracking = useButtonTracking({
    analyticsEventName: props.analyticsEventName,
    analyticsEventKey: props.analyticsEventKey,
    analyticsParams: {
      priority: props.priority,
      href: 'href' in props ? props.href : undefined,
      ...props.analyticsParams,
    },
    'aria-label': accessibleLabel || '',
  });

  const handleClick = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    // Don't allow clicks when disabled or busy
    if (props.disabled || props.busy) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    buttonTracking();
    // @ts-expect-error at this point, we don't know if the button is a button or a link
    props.onClick?.(e);
  };

  const hasChildren = Array.isArray(props.children)
    ? props.children.some(child => !!child || String(child) === '0')
    : !!props.children || String(props.children) === '0';

  // Buttons come in 4 flavors: <Link>, <ExternalLink>, <a>, and <button>.
  // Let's use props to determine which to serve up, so we don't have to think about it.
  // *Note* you must still handle tabindex manually.

  return {
    handleClick,
    hasChildren,
    accessibleLabel,
  };
}
