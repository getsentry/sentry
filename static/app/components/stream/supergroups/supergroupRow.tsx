import styled from '@emotion/styled';

import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Text} from '@sentry/scraps/text';

import {PanelItem} from 'sentry/components/panels/panelItem';
import {IconChevron, IconStack} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {SupergroupDetail} from 'sentry/views/issueList/supergroups/types';

interface SupergroupRowProps {
  expanded: boolean;
  onToggle: () => void;
  supergroup: SupergroupDetail;
}

export function SupergroupRow({supergroup, expanded, onToggle}: SupergroupRowProps) {
  return (
    <Wrapper onClick={onToggle}>
      <InteractionStateLayer />
      <IconArea>
        <AccentIcon size="md" />
        <ExpandChevron direction={expanded ? 'down' : 'right'} size="sm" />
      </IconArea>
      <Summary>
        <Text size="md" bold ellipsis>
          {supergroup.title}
        </Text>
        <Text size="sm" variant="muted" ellipsis>
          {supergroup.error_type}
        </Text>
        <MetaRow>
          {supergroup.code_area ? (
            <Text size="sm" variant="muted" ellipsis>
              {supergroup.code_area}
            </Text>
          ) : null}
          {supergroup.code_area ? <Dot /> : null}
          <Text size="sm" variant="muted">
            {`${supergroup.group_ids.length} ${t('issues')}`}
          </Text>
        </MetaRow>
      </Summary>
    </Wrapper>
  );
}

const Wrapper = styled(PanelItem)`
  position: relative;
  line-height: 1.1;
  padding: ${p => p.theme.space.md} 0;
  cursor: pointer;
`;

const Summary = styled('div')`
  overflow: hidden;
  margin-left: ${p => p.theme.space.md};
  margin-right: ${p => p.theme.space['3xl']};
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: ${p => p.theme.space.xs};
  font-size: ${p => p.theme.font.size.md};
`;

const IconArea = styled('div')`
  align-self: flex-start;
  width: 32px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
  padding-top: ${p => p.theme.space.sm};
  gap: ${p => p.theme.space.sm};
`;

const AccentIcon = styled(IconStack)`
  color: ${p => p.theme.tokens.graphics.accent.vibrant};
`;

const ExpandChevron = styled(IconChevron)`
  color: ${p => p.theme.tokens.content.secondary};
  margin-top: ${p => p.theme.space.xs};
`;

const MetaRow = styled('div')`
  display: inline-grid;
  grid-auto-flow: column dense;
  gap: ${p => p.theme.space.sm};
  justify-content: start;
  align-items: center;
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
  white-space: nowrap;
  line-height: 1.2;
  min-height: ${p => p.theme.space.xl};
`;

const Dot = styled('div')`
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: currentcolor;
  flex-shrink: 0;
`;
