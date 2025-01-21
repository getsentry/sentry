import {getContextKeys} from 'sentry/components/events/contexts/utils';
import {t} from 'sentry/locale';
import {type UnityContext, UnityContextKey} from 'sentry/types/event';
import type {KeyValueListData} from 'sentry/types/group';

export function getUnityContextData({data}: {data: UnityContext}): KeyValueListData {
  return getContextKeys({data}).map(ctxKey => {
    switch (ctxKey) {
      case UnityContextKey.COPY_TEXTURE_SUPPORT:
        return {
          key: ctxKey,
          subject: t('Copy Texture Support'),
          value: data.copy_texture_support,
        };
      case UnityContextKey.EDITOR_VERSION:
        return {
          key: ctxKey,
          subject: t('Editor Version'),
          value: data.editor_version,
        };
      case UnityContextKey.INSTALL_MODE:
        return {
          key: ctxKey,
          subject: t('Install Mode'),
          value: data.install_mode,
        };
      case UnityContextKey.RENDERING_THREADING_MODE:
        return {
          key: ctxKey,
          subject: t('Rendering Threading Mode'),
          value: data.rendering_threading_mode,
        };
      case UnityContextKey.TARGET_FRAME_RATE:
        return {
          key: ctxKey,
          subject: t('Target Frame Rate'),
          value: data.target_frame_rate,
        };
      default:
        return {
          key: ctxKey,
          subject: ctxKey,
          // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          value: data[ctxKey],
        };
    }
  });
}
