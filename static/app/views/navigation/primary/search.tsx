import {isMac} from '@react-aria/utils';
import {IconSearch} from '@sentry/icons/search';

import {formatHotkey} from '@sentry/scraps/hotkey';
import {Flex} from '@sentry/scraps/layout';
import {SizeProvider} from '@sentry/scraps/sizeContext';

import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';
import {useToggleCommandPaletteFromButton} from 'sentry/views/navigation/searchButton';

import {PrimaryNavigation} from './components';

/**
 * Opens the command palette from the primary navigation. On mobile the
 * command palette button lives in the mobile header row instead.
 */
export function PrimaryNavigationSearch() {
  const organization = useOrganization({allowNull: true});
  const {layout} = usePrimaryNavigation();
  const toggleCommandPalette = useToggleCommandPaletteFromButton();

  if (!organization || layout === 'mobile') {
    return null;
  }

  return (
    <SizeProvider size="sm">
      <Flex justify="center" width="100%" padding="md xs">
        <PrimaryNavigation.Button
          analyticsKey="search"
          label={t('Command Palette')}
          visibleLabel={formatHotkey('Mod+K')}
          buttonProps={{
            icon: <IconSearch />,
            'aria-keyshortcuts': isMac() ? 'Meta+K' : 'Control+K',
            onClick: toggleCommandPalette,
          }}
        />
      </Flex>
    </SizeProvider>
  );
}
