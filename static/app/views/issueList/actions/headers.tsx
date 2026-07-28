import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import type {GroupListColumn} from 'sentry/components/issues/groupList';
import {IssueStreamHeaderLabel} from 'sentry/components/IssueStreamHeaderLabel';
import {ToolbarHeader} from 'sentry/components/toolbarHeader';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {COLUMN_BREAKPOINTS} from 'sentry/views/issueList/actions/utils';

type Props = {
  isReprocessingQuery: boolean;
  onSelectStatsPeriod: (statsPeriod: string) => void;
  selection: PageFilters;
  statsPeriod: string;
  withColumns?: GroupListColumn[];
};

export function Headers({
  selection,
  statsPeriod,
  onSelectStatsPeriod,
  isReprocessingQuery,
  withColumns,
}: Props) {
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
          <IssueStreamHeaderLabel
            display={{zero: 'none', [COLUMN_BREAKPOINTS.LAST_SEEN]: 'inline-block'}}
            align="right"
            width="86px"
          >
            {t('Last Seen')}
          </IssueStreamHeaderLabel>
          <IssueStreamHeaderLabel
            display={{zero: 'none', [COLUMN_BREAKPOINTS.FIRST_SEEN]: 'inline-block'}}
            align="right"
            width="50px"
          >
            {t('Age')}
          </IssueStreamHeaderLabel>
          <IssueStreamHeaderLabel
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
          </IssueStreamHeaderLabel>
          <IssueStreamHeaderLabel
            display={{zero: 'none', [COLUMN_BREAKPOINTS.EVENTS]: 'inline-block'}}
            align="right"
            width="60px"
          >
            {t('Events')}
          </IssueStreamHeaderLabel>
          <IssueStreamHeaderLabel
            display={{zero: 'none', [COLUMN_BREAKPOINTS.USERS]: 'inline-block'}}
            align="right"
            width="60px"
          >
            {t('Users')}
          </IssueStreamHeaderLabel>
          {withColumns?.includes('progress') ? (
            <IssueStreamHeaderLabel
              display={{zero: 'none', [COLUMN_BREAKPOINTS.PROGRESS]: 'inline-block'}}
              align="left"
              width="124px"
            >
              {t('Progress')}
            </IssueStreamHeaderLabel>
          ) : (
            <IssueStreamHeaderLabel
              display={{zero: 'none', [COLUMN_BREAKPOINTS.PRIORITY]: 'inline-block'}}
              align="left"
              width="64px"
            >
              {t('Priority')}
            </IssueStreamHeaderLabel>
          )}
          <IssueStreamHeaderLabel
            display={{zero: 'none', [COLUMN_BREAKPOINTS.ASSIGNEE]: 'inline-block'}}
            align="right"
            width="66px"
          >
            {t('Assignee')}
          </IssueStreamHeaderLabel>
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
