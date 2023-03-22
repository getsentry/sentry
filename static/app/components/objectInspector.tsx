import {ComponentProps, useMemo} from 'react';
import {
  chromeDark,
  chromeLight,
  ObjectInspector as OrigObjectInspector,
} from 'react-inspector';
import {useTheme} from '@emotion/react';

import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

type Props = Omit<ComponentProps<typeof ReactObjectInspector>, 'theme'> & {
  theme?: Record<string, any>;
};

function ObjectInspector({data, theme, ...props}: Props) {
  const config = useLegacyStore(ConfigStore);
  const emotionTheme = useTheme();
  const isDark = config.theme === 'dark';

  const INSPECTOR_THEME = useMemo(
    () => ({
      ...(isDark ? chromeDark : chromeLight),

      // Reset some theme values
      BASE_COLOR: 'inherit',
      ERROR_COLOR: emotionTheme.red400,
      TREENODE_FONT_FAMILY: 'inherit',
      TREENODE_FONT_SIZE: 'inherit',
      TREENODE_LINE_HEIGHT: 'inherit',
      BASE_BACKGROUND_COLOR: 'none',

      OBJECT_PREVIEW_OBJECT_MAX_PROPERTIES: 1,
      ...theme,
    }),
    [isDark, theme, emotionTheme.red400]
  );

  return (
    <OrigObjectInspector
      data={data}
      // @ts-expect-error
      theme={INSPECTOR_THEME}
      {...props}
    />
  );
}

export default ObjectInspector;
