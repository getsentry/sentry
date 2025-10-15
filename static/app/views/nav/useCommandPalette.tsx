import {
  openCommandPalette,
  openCommandPaletteDeprecated,
} from 'sentry/actionCreators/modal';
import {useGlobalCommandPaletteActions} from 'sentry/components/commandPalette/useGlobalCommandPaletteActions';
import {useGlobalModal} from 'sentry/components/globalModal/useGlobalModal';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import useOrganization from 'sentry/utils/useOrganization';

export function useCommandPalette() {
  const organization = useOrganization();
  const {visible: isModalOpen} = useGlobalModal();
  useGlobalCommandPaletteActions();

  useHotkeys(
    isModalOpen
      ? []
      : [
          {
            match: ['command+shift+p', 'command+k', 'ctrl+shift+p', 'ctrl+k'],
            callback: () => {
              if (organization.features.includes('cmd-k-supercharged')) {
                openCommandPalette();
              } else {
                openCommandPaletteDeprecated();
              }
            },
          },
        ]
  );
}
