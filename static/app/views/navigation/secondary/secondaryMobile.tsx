import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';

import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {SecondaryNavigationContent} from 'sentry/views/navigation/secondary/secondaryNavigationContent';

type Props = {
  handleClickBack: () => void;
};

export function SecondaryMobile({handleClickBack}: Props) {
  return (
    <SecondaryMobileWrapper>
      <GroupHeader>
        <Button
          onClick={handleClickBack}
          icon={<IconChevron direction="left" />}
          aria-label={t('Back to primary navigation')}
          size="xs"
          priority="transparent"
        >
          {t('Back')}
        </Button>
      </GroupHeader>
      <Stack justify="between" align="stretch" overflowY="auto" area="content">
        <SecondaryNavigationContent />
      </Stack>
    </SecondaryMobileWrapper>
  );
}

const SecondaryMobileWrapper = styled('div')`
  position: relative;
  height: 100%;

  display: grid;
  grid-template-areas:
    'header'
    'content';
  grid-template-rows: auto 1fr;
`;

const GroupHeader = styled('h2')`
  grid-area: header;
  position: sticky;
  top: 0;
  z-index: 1;
  background: ${p => p.theme.tokens.background.tertiary};
  display: flex;
  align-items: center;
  padding: ${p => p.theme.space.xl} ${p => p.theme.space.md};
  gap: ${p => p.theme.space.md};
  margin: 0;
`;
