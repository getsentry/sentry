import styled from '@emotion/styled';

import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Text} from '@sentry/scraps/text';

import {useDrawer} from 'sentry/components/globalDrawer';
import {IconStack} from 'sentry/icons';
import {t} from 'sentry/locale';
import {SupergroupDetailDrawer} from 'sentry/views/issueList/supergroups/supergroupDrawer';
import type {SupergroupDetail} from 'sentry/views/issueList/supergroups/types';

interface Props {
  otherCount: number;
  supergroup: SupergroupDetail;
}

export function StackIndicatorBar({supergroup, otherCount}: Props) {
  const {openDrawer} = useDrawer();

  const handleClick = () => {
    openDrawer(() => <SupergroupDetailDrawer supergroup={supergroup} />, {
      ariaLabel: t('Supergroup details'),
      drawerKey: 'supergroup-drawer',
    });
  };

  return (
    <Bar onClick={handleClick}>
      <InteractionStateLayer />
      <CurvedArrow aria-hidden>&#8627;</CurvedArrow>
      <StyledIconStack size="xs" />
      <Text size="xs" bold>
        {t('%s other issues', otherCount)}
      </Text>
      <Dot />
      <Title size="xs" variant="muted">
        {supergroup.title}
      </Title>
    </Bar>
  );
}

const Bar = styled('button')`
  position: relative;
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
  width: 100%;
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.xl};
  background: ${p => p.theme.tokens.background.secondary};
  border: none;
  border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  cursor: pointer;
  color: ${p => p.theme.tokens.content.secondary};
  font-family: inherit;
  font-size: ${p => p.theme.font.size.sm};
  line-height: 1.4;
  text-align: left;
`;

const CurvedArrow = styled('span')`
  font-size: ${p => p.theme.font.size.lg};
  line-height: 1;
`;

const StyledIconStack = styled(IconStack)`
  flex-shrink: 0;
`;

const Dot = styled('div')`
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: ${p => p.theme.tokens.border.secondary};
  flex-shrink: 0;
`;

const Title = styled(Text)`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
`;
