import {getContextKeys} from 'sentry/components/events/contexts/utils';
import {t} from 'sentry/locale';
import type {KeyValueListData} from 'sentry/types/group';

enum AccessibilityContextKeys {
  ACCESSIBLE_NAVIGATION = 'accessible_navigation',
  BOLD_TEXT = 'bold_text',
  DISABLE_ANIMATIONS = 'disable_animations',
  HIGH_CONTRAST = 'high_contrast',
  INVERT_COLORS = 'invert_colors',
  REDUCE_MOTION = 'reduce_motion',
}

export interface AccessibilityContext {
  [key: string]: any;
  [AccessibilityContextKeys.ACCESSIBLE_NAVIGATION]?: boolean;
  [AccessibilityContextKeys.BOLD_TEXT]?: boolean;
  [AccessibilityContextKeys.DISABLE_ANIMATIONS]?: boolean;
  [AccessibilityContextKeys.HIGH_CONTRAST]?: boolean;
  [AccessibilityContextKeys.INVERT_COLORS]?: boolean;
  [AccessibilityContextKeys.REDUCE_MOTION]?: boolean;
}

export function getAccessibilityContextData({
  data,
  meta,
}: {
  data: AccessibilityContext;
  meta?: Record<keyof AccessibilityContext, any>;
}): KeyValueListData {
  return getContextKeys({data}).map(ctxKey => {
    switch (ctxKey) {
      case AccessibilityContextKeys.ACCESSIBLE_NAVIGATION:
        return {
          key: ctxKey,
          subject: t('Accessible Navigation'),
          value: data.accessible_navigation,
        };
      case AccessibilityContextKeys.BOLD_TEXT:
        return {
          key: ctxKey,
          subject: t('Bold Text'),
          value: data.bold_text,
        };
      case AccessibilityContextKeys.DISABLE_ANIMATIONS:
        return {
          key: ctxKey,
          subject: t('Disable Animations'),
          value: data.disable_animations,
        };
      case AccessibilityContextKeys.HIGH_CONTRAST:
        return {
          key: ctxKey,
          subject: t('High Contrast'),
          value: data.high_contrast,
        };
      case AccessibilityContextKeys.INVERT_COLORS:
        return {
          key: ctxKey,
          subject: t('Invert Colors'),
          value: data.invert_colors,
        };
      case AccessibilityContextKeys.REDUCE_MOTION:
        return {
          key: ctxKey,
          subject: t('Reduce Motion'),
          value: data.reduce_motion,
        };
      default:
        return {
          key: ctxKey,
          subject: ctxKey,
          value: data[ctxKey],
          meta: meta?.[ctxKey]?.[''],
        };
    }
  });
}
