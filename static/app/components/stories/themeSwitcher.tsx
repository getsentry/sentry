import {useCallback} from 'react';

import {Button} from 'sentry/components/button';
import {IconMoon} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

export default function ThemeSwitcher() {
  const config = useLegacyStore(ConfigStore);
  const isDark = config.theme === 'dark';

  const handleClick = useCallback(() => {
    ConfigStore.set('theme', isDark ? 'light' : 'dark');
  }, [isDark]);

  return (
    <Button
      size="xs"
      onClick={handleClick}
      icon={<IconMoon />}
      aria-label={isDark ? t('Switch to Light Mode') : t('Switch to Dark Mode')}
      title={isDark ? t('Switch to Light Mode') : t('Switch to Dark Mode')}
    />
  );
}
