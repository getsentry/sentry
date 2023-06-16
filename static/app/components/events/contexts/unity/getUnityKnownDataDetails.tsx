import {t} from 'sentry/locale';
import {UnityContext, UnityContextKey} from 'sentry/types/event';

export const unityKnownDataValues = Object.values(UnityContextKey);

type Output = {
  subject: string;
  value: React.ReactNode | null;
};

type Props = {
  data: UnityContext;
  type: (typeof unityKnownDataValues)[number];
};

export function getUnityKnownDataDetails({data, type}: Props): Output | undefined {
  switch (type) {
    case UnityContextKey.COPY_TEXTURE_SUPPORT:
      return {
        subject: t('Copy Texture Support'),
        value: data.copy_texture_support,
      };
    case UnityContextKey.EDITOR_VERSION:
      return {
        subject: t('Editor Version'),
        value: data.editor_version,
      };
    case UnityContextKey.INSTALL_MODE:
      return {
        subject: t('Install Mode'),
        value: data.install_mode,
      };
    case UnityContextKey.RENDERING_THREADING_MODE:
      return {
        subject: t('Rendering Threading Mode'),
        value: data.rendering_threading_mode,
      };
    case UnityContextKey.TARGET_FRAME_RATE:
      return {
        subject: t('Target Frame Rate'),
        value: data.target_frame_rate,
      };
    default:
      return undefined;
  }
}
