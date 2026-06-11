import {getContextKeys} from 'sentry/components/events/contexts/utils';
import {t} from 'sentry/locale';
import type {KeyValueListData} from 'sentry/types/group';

enum ReactNativeContextKeys {
  EXPO = 'expo',
  FABRIC = 'fabric',
  HERMES_DEBUG_INFO = 'hermes_debug_info',
  HERMES_VERSION = 'hermes_version',
  JS_ENGINE = 'js_engine',
  REACT_NATIVE_VERSION = 'react_native_version',
  TURBO_MODULE = 'turbo_module',
}

export interface ReactNativeContext {
  [key: string]: any;
  [ReactNativeContextKeys.EXPO]?: boolean;
  [ReactNativeContextKeys.FABRIC]?: boolean;
  [ReactNativeContextKeys.HERMES_DEBUG_INFO]?: boolean;
  [ReactNativeContextKeys.HERMES_VERSION]?: string;
  [ReactNativeContextKeys.JS_ENGINE]?: string;
  [ReactNativeContextKeys.REACT_NATIVE_VERSION]?: string;
  [ReactNativeContextKeys.TURBO_MODULE]?: boolean;
}

export function getReactNativeContextData({
  data,
  meta,
}: {
  data: ReactNativeContext;
  meta?: Record<keyof ReactNativeContext, any>;
}): KeyValueListData {
  return getContextKeys({data}).map(ctxKey => {
    switch (ctxKey) {
      case ReactNativeContextKeys.EXPO:
        return {
          key: ctxKey,
          subject: t('Expo'),
          value: data.expo,
        };
      case ReactNativeContextKeys.FABRIC:
        return {
          key: ctxKey,
          subject: t('Fabric'),
          value: data.fabric,
        };
      case ReactNativeContextKeys.HERMES_DEBUG_INFO:
        return {
          key: ctxKey,
          subject: t('Hermes Debug Info'),
          value: data.hermes_debug_info,
        };
      case ReactNativeContextKeys.HERMES_VERSION:
        return {
          key: ctxKey,
          subject: t('Hermes Version'),
          value: data.hermes_version,
        };
      case ReactNativeContextKeys.JS_ENGINE:
        return {
          key: ctxKey,
          subject: t('JS Engine'),
          value: data.js_engine,
        };
      case ReactNativeContextKeys.REACT_NATIVE_VERSION:
        return {
          key: ctxKey,
          subject: t('React Native Version'),
          value: data.react_native_version,
        };
      case ReactNativeContextKeys.TURBO_MODULE:
        return {
          key: ctxKey,
          subject: t('Turbo Module'),
          value: data.turbo_module,
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
