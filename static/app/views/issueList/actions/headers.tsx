import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {ToolbarHeader} from 'sentry/components/toolbarHeader';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {HeaderContextMenu} from 'sentry/views/issueList/actions/headerContextMenu';
import {COLUMN_BREAKPOINTS} from 'sentry/views/issueList/actions/utils';
import {useIssueDisplayProperties} from 'sentry/views/issueList/displayProperties';

type Props = {
  isReprocessingQuery: boolean;
  onSelectStatsPeriod: (statsPeriod: string) => void;
  selection: PageFilters;
  statsPeriod: string;
};

export function Headers({
  selection,
  statsPeriod,
  onSelectStatsPeriod,
  isReprocessingQuery,
}: Props) {
  const {columns} = useIssueDisplayProperties();
  return (
    <Fragment>
      {isReprocessingQuery ? (
        <Fragment>
          <ToolbarHeader
            width={{zero: '85px', xl: '140px'}}
            margin="0 xl"
            whiteSpace="nowrap"
            overflow="hidden"
            style={{textOverflow: 'ellipsis'}}
          >
            {t('Started')}
          </ToolbarHeader>
          <ToolbarHeader
            width={{zero: '75px', xl: '140px'}}
            margin="0 xl"
            whiteSpace="nowrap"
            overflow="hidden"
            style={{textOverflow: 'ellipsis'}}
          >
            {t('Events Reprocessed')}
          </ToolbarHeader>
          <ToolbarHeader
            display={{zero: 'none', xl: 'block'}}
            width="160px"
            margin="0 xl"
          >
            {t('Progress')}
          </ToolbarHeader>
        </Fragment>
      ) : (
        <Fragment>
          {columns.includes('lastSeen') && (
            <HeaderContextMenu
              column="lastSeen"
              display={{zero: 'none', [COLUMN_BREAKPOINTS.LAST_SEEN]: 'inline-block'}}
              align="right"
              width="86px"
            >
              {t('Last Seen')}
            </HeaderContextMenu>
          )}
          {columns.includes('firstSeen') && (
            <HeaderContextMenu
              column="firstSeen"
              display={{zero: 'none', [COLUMN_BREAKPOINTS.FIRST_SEEN]: 'inline-block'}}
              align="right"
              width="50px"
            >
              {t('Age')}
            </HeaderContextMenu>
          )}
          {columns.includes('graph') && (
            <HeaderContextMenu
              column="graph"
              display={{zero: 'none', [COLUMN_BREAKPOINTS.TREND]: 'flex'}}
              width="175px"
              flex="1"
              style={{justifyContent: 'space-between', padding: 0}}
            >
              <Flex flex="1" justify="between">
                {t('Trend')}
                <GraphToggles>
                  {selection.datetime.period !== '24h' && (
                    <GraphToggle
                      active={statsPeriod === '24h'}
                      onClick={() => onSelectStatsPeriod('24h')}
                    >
                      {t('24h')}
                    </GraphToggle>
                  )}
                  <GraphToggle
                    active={statsPeriod === 'auto'}
                    onClick={() => onSelectStatsPeriod('auto')}
                  >
                    {selection.datetime.period || t('Custom')}
                  </GraphToggle>
                </GraphToggles>
              </Flex>
            </HeaderContextMenu>
          )}
          {columns.includes('event') && (
            <HeaderContextMenu
              column="event"
              display={{zero: 'none', [COLUMN_BREAKPOINTS.EVENTS]: 'inline-block'}}
              align="right"
              width="60px"
            >
              {t('Events')}
            </HeaderContextMenu>
          )}
          {columns.includes('users') && (
            <HeaderContextMenu
              column="users"
              display={{zero: 'none', [COLUMN_BREAKPOINTS.USERS]: 'inline-block'}}
              align="right"
              width="60px"
            >
              {t('Users')}
            </HeaderContextMenu>
          )}
          {columns.includes('priority') && (
            <HeaderContextMenu
              column="priority"
              display={{zero: 'none', [COLUMN_BREAKPOINTS.PRIORITY]: 'inline-block'}}
              align="left"
              width="64px"
            >
              {t('Priority')}
            </HeaderContextMenu>
          )}
          {columns.includes('assignee') && (
            <HeaderContextMenu
              column="assignee"
              display={{zero: 'none', [COLUMN_BREAKPOINTS.ASSIGNEE]: 'inline-block'}}
              align="right"
              width="66px"
            >
              {t('Assignee')}
            </HeaderContextMenu>
          )}
        </Fragment>
      )}
    </Fragment>
  );
}

const GraphToggles = styled('div')`
  font-weight: ${p => p.theme.font.weight.sans.regular};
  margin-right: ${p => p.theme.space.xl};
`;

const GraphToggle = styled('a')<{active: boolean}>`
  font-size: 13px;
  padding-left: ${p => p.theme.space.md};

  &,
  &:hover,
  &:focus,
  &:active {
    color: ${p =>
      p.active ? p.theme.tokens.content.primary : p.theme.tokens.content.disabled};
  }
`;

// Reprocessing
