import {useCallback, useEffect, useState} from 'react';

import {Button} from 'sentry/components/button';
import ConfigStore from 'sentry/stores/configStore';

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState(() => ConfigStore.get('theme'));

  const isDark = theme === 'dark';
  const label = isDark ? 'Use Light Mode' : 'Use Dark Mode';
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
    <Button size="sm" onClick={handleClick}>
      {label}
    </Button>
  );
}
