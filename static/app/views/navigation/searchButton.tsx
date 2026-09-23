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

interface SearchButtonProps extends Pick<ButtonProps, 'className' | 'size' | 'variant'> {
  label?: string;
}

export function SearchButton({
  label = t('Command Palette'),
  variant = 'secondary',
  ...props
}: SearchButtonProps) {
  const organization = useOrganization({allowNull: true});
  const state = useCommandPaletteState();
  const dispatch = useCommandPaletteDispatch();
  const {openSeerExplorer} = useSeerExplorerContext();
  return (
    <Button
      {...props}
      variant={variant}
      icon={<IconSearch size="xs" />}
      aria-label={label}
      tooltipProps={{
        title: (
          <Flex align="center" gap="sm">
            {label}
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
