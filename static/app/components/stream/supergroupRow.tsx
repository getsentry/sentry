import {useState} from 'react';
import styled from '@emotion/styled';

import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Text} from '@sentry/scraps/text';

import {GroupStatusChart} from 'sentry/components/charts/groupStatusChart';
import {Count} from 'sentry/components/count';
import {useDrawer} from 'sentry/components/globalDrawer';
import {PanelItem} from 'sentry/components/panels/panelItem';
import {Placeholder} from 'sentry/components/placeholder';
import {TimeSince} from 'sentry/components/timeSince';
import {IconStack} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {AggregatedSupergroupStats} from 'sentry/utils/supergroup/aggregateSupergroupStats';
import {COLUMN_BREAKPOINTS} from 'sentry/views/issueList/actions/utils';
import {SupergroupDetailDrawer} from 'sentry/views/issueList/supergroups/supergroupDrawer';
import type {SupergroupDetail} from 'sentry/views/issueList/supergroups/types';

interface SupergroupRowProps {
  matchedCount: number;
  supergroup: SupergroupDetail;
  aggregatedStats?: AggregatedSupergroupStats | null;
}

export function SupergroupRow({
  supergroup,
  matchedCount,
  aggregatedStats,
}: SupergroupRowProps) {
  const {openDrawer, isDrawerOpen} = useDrawer();
  const [isActive, setIsActive] = useState(false);
  const handleClick = () => {
    setIsActive(true);
    openDrawer(() => <SupergroupDetailDrawer supergroup={supergroup} />, {
      ariaLabel: t('Supergroup details'),
      drawerKey: 'supergroup-drawer',
      onClose: () => setIsActive(false),
    });
  };

  const highlighted = isActive && isDrawerOpen;

  return (
    <Wrapper onClick={handleClick} highlighted={highlighted}>
      <InteractionStateLayer />
      <IconArea>
        <AccentIcon size="md" />
      </IconArea>
      <Summary>
        {supergroup.error_type ? (
          <Text size="md" bold ellipsis>
            {supergroup.error_type}
          </Text>
        ) : null}
        <Text size="sm" variant="muted" ellipsis>
          {supergroup.title}
        </Text>
        <MetaRow>
          {supergroup.code_area ? (
            <Text size="sm" variant="muted" ellipsis>
              {supergroup.code_area}
            </Text>
          ) : null}
          {supergroup.code_area && matchedCount > 0 ? <Dot /> : null}
          {matchedCount > 0 ? (
            <Text size="sm" variant="muted">
              {matchedCount} / {supergroup.group_ids.length} {t('issues matched')}
            </Text>
          ) : null}
        </MetaRow>
      </Summary>

      <LastSeenColumn>
        {aggregatedStats?.lastSeen ? (
          <TimeSince
            date={aggregatedStats.lastSeen}
            suffix={t('ago')}
            unitStyle="short"
          />
        ) : (
          <Placeholder height="18px" width="70px" />
        )}
      </LastSeenColumn>

      <FirstSeenColumn>
        {aggregatedStats?.firstSeen ? (
          <TimeSince date={aggregatedStats.firstSeen} unitStyle="short" suffix="" />
        ) : (
          <Placeholder height="18px" width="30px" />
        )}
      </FirstSeenColumn>

      <ChartColumn>
        {aggregatedStats?.mergedStats && aggregatedStats.mergedStats.length > 0 ? (
          <GroupStatusChart hideZeros stats={aggregatedStats.mergedStats} showMarkLine />
        ) : (
          <Placeholder height="36px" />
        )}
      </ChartColumn>

      <EventsColumn>
        {aggregatedStats ? (
          <PrimaryCount value={aggregatedStats.eventCount} />
        ) : (
          <Placeholder height="18px" width="40px" />
        )}
      </EventsColumn>

      <UsersColumn>
        {aggregatedStats ? (
          <PrimaryCount value={aggregatedStats.userCount} />
        ) : (
          <Placeholder height="18px" width="40px" />
        )}
      </UsersColumn>

      <PrioritySpacer />
      <AssigneeSpacer />
    </Wrapper>
  );
}

const Wrapper = styled(PanelItem)<{highlighted: boolean}>`
  position: relative;
  line-height: 1.1;
  padding: ${p => p.theme.space.md} 0;
  cursor: pointer;
  min-height: 82px;
  background: ${p =>
    p.highlighted ? p.theme.tokens.background.secondary : 'transparent'};
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
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
  padding-top: ${p => p.theme.space.sm};
`;

const AccentIcon = styled(IconStack)`
  color: ${p => p.theme.tokens.graphics.accent.vibrant};
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

const LastSeenColumn = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 86px;
  padding-right: ${p => p.theme.space.xl};
  margin-right: ${p => p.theme.space.xl};

  @container (width < ${COLUMN_BREAKPOINTS.LAST_SEEN}) {
    display: none;
  }
`;

const FirstSeenColumn = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 50px;
  padding-right: ${p => p.theme.space.xl};
  margin-right: ${p => p.theme.space.xl};

  @container (width < ${COLUMN_BREAKPOINTS.FIRST_SEEN}) {
    display: none;
  }
`;

const ChartColumn = styled('div')`
  width: 175px;
  align-self: center;
  margin-right: ${p => p.theme.space.xl};

  @container (width < ${COLUMN_BREAKPOINTS.TREND}) {
    display: none;
  }
`;

const DataColumn = styled('div')`
  display: flex;
  justify-content: flex-end;
  text-align: right;
  align-items: center;
  align-self: center;
  padding-right: ${p => p.theme.space.xl};
  margin-right: ${p => p.theme.space.xl};
  width: 60px;
`;

const EventsColumn = styled(DataColumn)`
  @container (width < ${COLUMN_BREAKPOINTS.EVENTS}) {
    display: none;
  }
`;

const UsersColumn = styled(DataColumn)`
  @container (width < ${COLUMN_BREAKPOINTS.USERS}) {
    display: none;
  }
`;

const PrimaryCount = styled(Count)`
  font-size: ${p => p.theme.font.size.md};
  display: flex;
  justify-content: right;
  margin-bottom: ${p => p.theme.space['2xs']};
  font-variant-numeric: tabular-nums;
`;

// Empty spacers to match StreamGroup column widths and keep alignment
const PrioritySpacer = styled('div')`
  width: 64px;
  padding-right: ${p => p.theme.space.xl};
  margin-right: ${p => p.theme.space.xl};

  @container (width < ${COLUMN_BREAKPOINTS.PRIORITY}) {
    display: none;
  }
`;

const AssigneeSpacer = styled('div')`
  width: 66px;
  padding-right: ${p => p.theme.space.xl};
  margin-right: ${p => p.theme.space.xl};

  @container (width < ${COLUMN_BREAKPOINTS.ASSIGNEE}) {
    display: none;
  }
`;
