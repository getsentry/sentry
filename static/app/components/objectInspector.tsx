import {ComponentPropsWithoutRef, useMemo} from 'react';
import {
  chromeDark,
  chromeLight,
  ObjectInspector as OrigObjectInspector,
} from 'react-inspector';

import ConfigStore from 'sentry/stores/configStore';

type Props = Omit<ComponentPropsWithoutRef<typeof OrigObjectInspector>, 'theme'>;

function ObjectInspector({data}: Props) {
  const isDark = ConfigStore.get('theme') === 'dark';

  const INSPECTOR_THEME = useMemo(
    () => ({
      ...(isDark ? chromeDark : chromeLight),
      BASE_BACKGROUND_COLOR: 'none',
      OBJECT_PREVIEW_OBJECT_MAX_PROPERTIES: 1,
    }),
    [isDark]
  );

  return (
    <OrigObjectInspector
      data={data}
      // @ts-expect-error
      theme={INSPECTOR_THEME}
    />
  );
}

export default ObjectInspector;
