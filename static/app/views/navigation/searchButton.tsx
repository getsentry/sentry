import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Hotkey} from '@sentry/scraps/hotkey';
import {Container, Flex} from '@sentry/scraps/layout';

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

export function SearchButton() {
  const organization = useOrganization({allowNull: true});
  const state = useCommandPaletteState();
  const dispatch = useCommandPaletteDispatch();
  const {openSeerExplorer} = useSeerExplorerContext();

  return (
    <StyledButton
      variant="secondary"
      icon={<IconSearch size="xs" />}
      aria-label={t('Search')}
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
    >
      <Flex align="center" gap="sm">
        <Container>{t('Search')}</Container>
        <Container display={{xs: 'none', md: 'inline-block'}}>
          <Hotkey value="mod+k" variant="debossed" />
        </Container>
      </Flex>
    </StyledButton>
  );
}

const StyledButton = styled(Button)`
  > span:last-child {
    overflow: visible;
  }
`;
