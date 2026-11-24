import {useCallback} from 'react';
import {IconSearch} from '@sentry/icons/search';

import {Button, type ButtonProps} from '@sentry/scraps/button';
import {Hotkey} from '@sentry/scraps/hotkey';
import {Flex} from '@sentry/scraps/layout';

import {toggleCommandPalette} from 'sentry/actionCreators/modal';
import {
  useCommandPaletteDispatch,
  useCommandPaletteState,
} from 'sentry/components/commandPalette/ui/commandPaletteStateContext';
import {t} from 'sentry/locale';
import {isSeerExplorerEnabled} from 'sentry/utils/seer/isSeerExplorerEnabled';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';

/**
 * Returns a callback that toggles the command palette from a button click.
 */
export function useToggleCommandPalette() {
  const organization = useOrganization({allowNull: true});
  const state = useCommandPaletteState();
  const dispatch = useCommandPaletteDispatch();
  const {openSeerExplorer} = useSeerExplorerContext();

  return useCallback(() => {
    if (!organization) {
      return;
    }
    toggleCommandPalette(
      {},
      organization,
      state,
      dispatch,
      'button',
      isSeerExplorerEnabled(organization) ? openSeerExplorer : undefined
    );
  }, [organization, state, dispatch, openSeerExplorer]);
}

export function SearchButton(props: Pick<ButtonProps, 'className'>) {
  const toggle = useToggleCommandPalette();
  return (
    <Button
      {...props}
      variant="secondary"
      icon={<IconSearch />}
      aria-label={t('Command Palette')}
      tooltipProps={{
        title: (
          <Flex align="center" gap="sm">
            {t('Command Palette')}
            <Hotkey value="Mod+K" />
          </Flex>
        ),
      }}
      onClick={toggle}
    />
  );
}
