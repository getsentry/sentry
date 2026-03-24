import {openCommandPalette} from 'sentry/actionCreators/modal';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PrimaryNavigation} from 'sentry/views/navigation/primary/components';

export function PrimaryNavigationSearch() {
  return (
    <PrimaryNavigation.Button
      analyticsKey="search"
      label={t('Search (%s)', 'cmd+k')}
      buttonProps={{
        icon: <IconSearch />,
        onClick: () => {
          openCommandPalette();
        },
      }}
    />
  );
}
