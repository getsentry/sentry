import {isMac} from '@react-aria/utils';
import {IconSearch} from '@sentry/icons/search';

import {Hotkey} from '@sentry/scraps/hotkey';
import {Flex} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useToggleCommandPalette} from 'sentry/views/navigation/searchButton';

import {PrimaryNavigation} from './components';

export function PrimaryNavigationCommandPalette() {
  const organization = useOrganization();
  const toggleCommandPalette = useToggleCommandPalette();

  return (
    <PrimaryNavigation.IconButton
      icon={<IconSearch />}
      aria-label={t('Command Palette')}
      aria-haspopup="dialog"
      aria-keyshortcuts={isMac() ? 'Meta+K' : 'Control+K'}
      tooltipProps={{
        position: 'right',
        title: (
          <Flex align="center" gap="sm">
            {t('Command Palette')}
            <Hotkey value="Mod+K" />
          </Flex>
        ),
      }}
      onClick={() => {
        trackAnalytics('navigation.primary_item_clicked', {
          item: 'command_palette',
          organization,
        });
        toggleCommandPalette();
      }}
    />
  );
}
