import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';

import {Button} from 'sentry/components/core/button';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PRIMARY_NAV_GROUP_CONFIG} from 'sentry/views/nav/primary/config';
import {SecondaryNavContent} from 'sentry/views/nav/secondary/secondaryNavContent';
import {useActiveNavGroup} from 'sentry/views/nav/useActiveNavGroup';

type Props = {
  handleClickBack: () => void;
};

export function SecondaryMobile({handleClickBack}: Props) {
  const activeGroup = useActiveNavGroup();

  return (
    <SecondaryMobileWrapper>
      <GroupHeader>
        <Button
          onClick={handleClickBack}
          icon={<IconChevron direction="left" />}
          aria-label={t('Back to primary navigation')}
          size="xs"
          borderless
        />
        <HeaderLabel>
          {activeGroup ? PRIMARY_NAV_GROUP_CONFIG[activeGroup].label : ''}
        </HeaderLabel>
      </GroupHeader>
      <Stack justify="between" align="stretch" overflowY="auto" area="content">
        <SecondaryNavContent group={activeGroup} />
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
  background: ${p => p.theme.colors.surface300};
  display: flex;
  align-items: center;
  padding: ${space(2)} ${space(1)};
  gap: ${space(1)};
  margin: 0;
`;

const HeaderLabel = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
`;
