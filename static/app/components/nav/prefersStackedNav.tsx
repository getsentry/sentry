import ConfigStore from 'sentry/stores/configStore';
import {useUser} from 'sentry/utils/useUser';

export function prefersStackedNav() {
  return ConfigStore.get('user')?.options?.prefersStackedNavigation ?? false;
}

export function usePrefersStackedNav() {
  const user = useUser();

  return user.options?.prefersStackedNavigation ?? false;
}
