import styled from '@emotion/styled';

import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {GroupStatusChart} from 'sentry/components/charts/groupStatusChart';
import {Count} from 'sentry/components/count';
import {PanelItem} from 'sentry/components/panels/panelItem';
import {Placeholder} from 'sentry/components/placeholder';
import {TimeSince} from 'sentry/components/timeSince';
import {IconStack} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {COLUMN_BREAKPOINTS} from 'sentry/views/issueList/actions/utils';
import type {AggregatedSupergroupStats} from 'sentry/views/issueList/supergroups/aggregateSupergroupStats';
import type {SupergroupDetail} from 'sentry/views/issueList/supergroups/types';
import {SUPERGROUP_DRAWER_QUERY_PARAM} from 'sentry/views/issueList/supergroups/useSupergroupDrawer';

interface SupergroupRowProps {
  supergroup: SupergroupDetail;
  aggregatedStats?: AggregatedSupergroupStats | null;
}

export function SupergroupRow({supergroup, aggregatedStats}: SupergroupRowProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const supergroupId = String(supergroup.id);
  const handleClick = () => {
    navigate(
      {
        pathname: location.pathname,
        query: {
          ...location.query,
          [SUPERGROUP_DRAWER_QUERY_PARAM]: supergroupId,
        },
      },
      {replace: true, preventScrollReset: true}
    );
  };

  const highlighted = location.query[SUPERGROUP_DRAWER_QUERY_PARAM] === supergroupId;

  return (
    <Wrapper
      onClick={handleClick}
      highlighted={highlighted}
      data-sentry-component="SupergroupRow"
    >
      <InteractionStateLayer />
      <IconArea>
        <AccentIcon size="md" />
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

      <Flex
        display={{zero: 'none', [COLUMN_BREAKPOINTS.LAST_SEEN]: 'flex'}}
        width="86px"
        paddingRight="xl"
        marginRight="xl"
        align="center"
        justify="end"
      >
        {aggregatedStats?.lastSeen ? (
          <TimeSince
            date={aggregatedStats.lastSeen}
            suffix={t('ago')}
            unitStyle="short"
          />
        ) : (
          <Placeholder height="18px" width="70px" />
        )}
      </Flex>

      <Flex
        display={{zero: 'none', [COLUMN_BREAKPOINTS.FIRST_SEEN]: 'flex'}}
        width="50px"
        paddingRight="xl"
        marginRight="xl"
        align="center"
        justify="end"
      >
        {aggregatedStats?.firstSeen ? (
          <TimeSince date={aggregatedStats.firstSeen} unitStyle="short" suffix="" />
        ) : (
          <Placeholder height="18px" width="30px" />
        )}
      </Flex>

      <Container
        display={{zero: 'none', [COLUMN_BREAKPOINTS.TREND]: 'block'}}
        width="175px"
        alignSelf="center"
        marginRight="xl"
      >
        {aggregatedStats?.mergedStats && aggregatedStats.mergedStats.length > 0 ? (
          <GroupStatusChart
            hideZeros
            stats={aggregatedStats.mergedFilteredStats ?? aggregatedStats.mergedStats}
            secondaryStats={
              aggregatedStats.mergedFilteredStats
                ? aggregatedStats.mergedStats
                : undefined
            }
            showSecondaryPoints={aggregatedStats.mergedFilteredStats !== null}
            showMarkLine
          />
        ) : (
          <Placeholder height="36px" />
        )}
      </Container>

      <Flex
        display={{zero: 'none', [COLUMN_BREAKPOINTS.EVENTS]: 'flex'}}
        alignSelf="center"
        paddingRight="xl"
        marginRight="xl"
        width="60px"
        align="center"
        justify="end"
      >
        {aggregatedStats ? (
          <Stack position="relative">
            <PrimaryCount
              value={aggregatedStats.filteredEventCount ?? aggregatedStats.eventCount}
            />
            {aggregatedStats.filteredEventCount !== null && (
              <SecondaryCount value={aggregatedStats.eventCount} />
            )}
          </Stack>
        ) : (
          <Placeholder height="18px" width="40px" />
        )}
      </Flex>

      <Flex
        display={{zero: 'none', [COLUMN_BREAKPOINTS.USERS]: 'flex'}}
        alignSelf="center"
        paddingRight="xl"
        marginRight="xl"
        width="60px"
        align="center"
        justify="end"
      >
        {aggregatedStats ? (
          <Stack position="relative">
            <PrimaryCount
              value={aggregatedStats.filteredUserCount ?? aggregatedStats.userCount}
            />
            {aggregatedStats.filteredUserCount !== null && (
              <SecondaryCount value={aggregatedStats.userCount} />
            )}
          </Stack>
        ) : (
          <Placeholder height="18px" width="40px" />
        )}
      </Flex>

      <Container
        display={{zero: 'none', [COLUMN_BREAKPOINTS.PRIORITY]: 'block'}}
        width="64px"
        paddingRight="xl"
        marginRight="xl"
      />
      <Container
        display={{zero: 'none', [COLUMN_BREAKPOINTS.ASSIGNEE]: 'block'}}
        width="66px"
        paddingRight="xl"
        marginRight="xl"
      />
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
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
  padding-top: ${p => p.theme.space.sm};
  gap: ${p => p.theme.space.xs};
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

const PrimaryCount = styled(Count)`
  font-size: ${p => p.theme.font.size.md};
  display: flex;
  justify-content: right;
  margin-bottom: ${p => p.theme.space['2xs']};
  font-variant-numeric: tabular-nums;
`;

const SecondaryCount = styled(Count)`
  font-size: ${p => p.theme.font.size.sm};
  display: flex;
  justify-content: flex-end;
  color: ${p => p.theme.tokens.content.secondary};
  font-variant-numeric: tabular-nums;
`;
