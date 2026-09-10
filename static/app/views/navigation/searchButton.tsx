import {Button, type ButtonProps} from '@sentry/scraps/button';
import {Hotkey} from '@sentry/scraps/hotkey';
import {Flex} from '@sentry/scraps/layout';

import {toggleCommandPalette} from 'sentry/actionCreators/modal';
import {
  useCommandPaletteDispatch,
  useCommandPaletteState,
} from 'sentry/components/commandPalette/ui/commandPaletteStateContext';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSeerExplorerContext} from 'sentry/views/seerExplorer/useSeerExplorerContext';
import {isSeerExplorerEnabled} from 'sentry/views/seerExplorer/utils';

export function SearchButton(props: Pick<ButtonProps, 'className'>) {
  const organization = useOrganization({allowNull: true});
  const state = useCommandPaletteState();
  const dispatch = useCommandPaletteDispatch();
  const {openSeerExplorer} = useSeerExplorerContext();
  return (
    <Button
      {...props}
      variant="secondary"
      icon={<IconSearch size="xs" />}
      aria-label={t('Command Palette')}
      tooltipProps={{
        title: (
          <Flex align="center" gap="sm">
            {t('Command Palette')}
            <Hotkey value="command+k" />
          </Flex>
        ),
      }}
      onClick={() => {
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
      }}
    />
  );
}
