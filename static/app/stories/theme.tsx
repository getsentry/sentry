import {IconMoon} from '@sentry/icons/moon';
import {useStore} from 'zustand';

import {Button} from '@sentry/scraps/button';

import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';

export function ThemeSwitcher() {
  const isDark = useStore(ConfigStore, state => state.theme === 'dark');

  const handleClick = () => {
    ConfigStore.set('theme', isDark ? 'light' : 'dark');
  };

  return (
    <Button
      size="xs"
      onClick={handleClick}
      icon={<IconMoon />}
      aria-label={isDark ? t('Switch to Light Mode') : t('Switch to Dark Mode')}
      tooltipProps={{
        title: isDark ? t('Switch to Light Mode') : t('Switch to Dark Mode'),
      }}
    />
  );
}
