import styled from '@emotion/styled';

import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Text} from '@sentry/scraps/text';

import {useDrawer} from 'sentry/components/globalDrawer';
import {PanelItem} from 'sentry/components/panels/panelItem';
import {IconStack} from 'sentry/icons';
import {t} from 'sentry/locale';
import {SupergroupDetailDrawer} from 'sentry/views/issueList/supergroups/supergroupDrawer';
import type {SupergroupDetail} from 'sentry/views/issueList/supergroups/types';

interface SupergroupRowProps {
  matchedCount: number;
  supergroup: SupergroupDetail;
}

export function SupergroupRow({supergroup, matchedCount}: SupergroupRowProps) {
  const {openDrawer} = useDrawer();
  const issueCount = supergroup.group_ids.length;

  const handleClick = () => {
    openDrawer(() => <SupergroupDetailDrawer supergroup={supergroup} />, {
      ariaLabel: t('Supergroup details'),
      drawerKey: 'supergroup-drawer',
    });
  };

  return (
    <Wrapper onClick={handleClick}>
      <InteractionStateLayer />
      <IconArea>
        <AccentIcon size="md" />
      </IconArea>
      <Content>
        {/* Line 1: error type — mirrors issue's error type title */}
        {supergroup.error_type ? (
          <ErrorType size="md">{supergroup.error_type}</ErrorType>
        ) : null}
        {/* Line 2: supergroup title — mirrors issue's error message */}
        <Subtitle size="sm" variant="muted">
          {supergroup.title}
        </Subtitle>
        {/* Line 3: metadata — mirrors issue's shortId | location | badges */}
        <MetaRow>
          {supergroup.code_area ? (
            <MetaText size="sm" variant="muted">
              {supergroup.code_area}
            </MetaText>
          ) : null}
          {supergroup.code_area && matchedCount > 0 ? <Dot /> : null}
          {matchedCount > 0 ? (
            <Text size="sm" variant="muted">
              <Text size="sm" bold as="span">
                {matchedCount}
              </Text>
              {' / '}
              <Text size="sm" bold as="span">
                {issueCount}
              </Text>
              {' '}
              {t('issues matched')}
            </Text>
          ) : null}
        </MetaRow>
      </Content>
    </Wrapper>
  );
}

const Wrapper = styled(PanelItem)`
  position: relative;
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
  cursor: pointer;
  gap: ${p => p.theme.space.lg};
  min-height: 82px;
  align-items: flex-start;
`;

const IconArea = styled('div')`
  padding-top: ${p => p.theme.space.xs};
  flex-shrink: 0;
`;

const AccentIcon = styled(IconStack)`
  color: ${p => p.theme.tokens.graphics.accent.vibrant};
`;

const Content = styled('div')`
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
`;

const ErrorType = styled(Text)`
  margin-bottom: ${p => p.theme.space.xs};
  font-weight: ${p => p.theme.font.weight.sans.medium};
`;

const Subtitle = styled(Text)`
  margin-bottom: 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

const MetaText = styled(Text)`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
`;

const Dot = styled('div')`
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: ${p => p.theme.tokens.border.secondary};
  flex-shrink: 0;
`;
