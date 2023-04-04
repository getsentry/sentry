import {ComponentProps, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import {
  chromeDark,
  chromeLight,
  ObjectInspector as OrigObjectInspector,
} from '@sentry-internal/react-inspector';

import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

type Props = Omit<ComponentProps<typeof OrigObjectInspector>, 'theme'> & {
  theme?: Record<string, any>;
};

const ObjectInspector = ({data, theme, ...props}: Props) => {
  const config = useLegacyStore(ConfigStore);
  const emotionTheme = useTheme();
  const isDark = config.theme === 'dark';

  const INSPECTOR_THEME = useMemo(
    () => ({
      ...(isDark ? chromeDark : chromeLight),

      // Reset some theme values
      BASE_COLOR: 'inherit',
      ERROR_COLOR: emotionTheme.red400,
      TREENODE_FONT_FAMILY: emotionTheme.text.familyMono,
      TREENODE_FONT_SIZE: 'inherit',
      TREENODE_LINE_HEIGHT: 'inherit',
      BASE_BACKGROUND_COLOR: 'none',
      ARROW_FONT_SIZE: '10px',

      OBJECT_PREVIEW_OBJECT_MAX_PROPERTIES: 1,
      ...theme,
    }),
    [isDark, theme, emotionTheme.red400, emotionTheme.text]
  );

  return (
    <OrigObjectInspector
      data={data}
      // @ts-expect-error
      theme={INSPECTOR_THEME}
      {...props}
    />
  );
};

export default ObjectInspector;
