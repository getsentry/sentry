import {useCallback, useEffect, useState} from 'react';

import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState(() => ConfigStore.get('theme'));

  const isDark = theme === 'dark';
  const label = isDark ? t('Switch to Light Mode') : t('Switch to Dark Mode');
  const handleClick = useCallback(() => {
    ConfigStore.set('theme', isDark ? 'light' : 'dark');
  }, [isDark]);

  useEffect(() => {
    const unsubscribe = ConfigStore.listen(change => {
      if ('theme' in change) {
        setTheme(change.theme);
      }
    }, {});
    return () => {
      unsubscribe();
    };
  });

  return (
    <Button size="xs" onClick={handleClick}>
      {label}
    </Button>
  );
}
