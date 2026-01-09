import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import IssueStreamHeaderLabel from 'sentry/components/IssueStreamHeaderLabel';
import ToolbarHeader from 'sentry/components/toolbarHeader';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import {COLUMN_BREAKPOINTS} from 'sentry/views/issueList/actions/utils';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

type Props = {
  isReprocessingQuery: boolean;
  onSelectStatsPeriod: (statsPeriod: string) => void;
  selection: PageFilters;
  statsPeriod: string;
  isSavedSearchesOpen?: boolean;
  onSortChange?: (sort: string) => void;
  sort?: string;
};

function Headers({
  selection,
  statsPeriod,
  onSelectStatsPeriod,
  isReprocessingQuery,
  onSortChange,
  sort,
}: Props) {
  return (
    <Fragment>
      {isReprocessingQuery ? (
        <Fragment>
          <StartedColumn>{t('Started')}</StartedColumn>
          <EventsReprocessedColumn>{t('Events Reprocessed')}</EventsReprocessedColumn>
          <ProgressColumn>{t('Progress')}</ProgressColumn>
        </Fragment>
      ) : (
        <Fragment>
          <SortableHeader
            breakpoint={COLUMN_BREAKPOINTS.LAST_SEEN}
            align="right"
            sortOption={IssueSortOptions.DATE}
            currentSort={sort}
            onSortChange={onSortChange}
            label={t('Last Seen')}
            width="86px"
          />
          <SortableHeader
            breakpoint={COLUMN_BREAKPOINTS.FIRST_SEEN}
            align="right"
            sortOption={IssueSortOptions.NEW}
            currentSort={sort}
            onSortChange={onSortChange}
            label={t('Age')}
            width="50px"
          />
          <GraphLabel breakpoint={COLUMN_BREAKPOINTS.TREND}>
            <Flex flex="1" justify="between">
              <SortableHeaderText
                sortOption={IssueSortOptions.TRENDS}
                currentSort={sort}
                onSortChange={onSortChange}
              >
                {t('Trend')}
              </SortableHeaderText>
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
          </GraphLabel>
          <SortableHeader
            breakpoint={COLUMN_BREAKPOINTS.EVENTS}
            align="right"
            sortOption={IssueSortOptions.FREQ}
            currentSort={sort}
            onSortChange={onSortChange}
            label={t('Events')}
            width="60px"
          />
          <SortableHeader
            breakpoint={COLUMN_BREAKPOINTS.USERS}
            align="right"
            sortOption={IssueSortOptions.USER}
            currentSort={sort}
            onSortChange={onSortChange}
            label={t('Users')}
            width="60px"
          />
          <PriorityLabel breakpoint={COLUMN_BREAKPOINTS.PRIORITY} align="left">
            {t('Priority')}
          </PriorityLabel>
          <AssigneeLabel breakpoint={COLUMN_BREAKPOINTS.ASSIGNEE} align="right">
            {t('Assignee')}
          </AssigneeLabel>
        </Fragment>
      )}
    </Fragment>
  );
}

function SortableHeader({
  breakpoint,
  align,
  sortOption,
  currentSort,
  onSortChange,
  label,
  width,
}: {
  align: 'left' | 'right';
  label: string;
  sortOption: IssueSortOptions;
  width: string;
  breakpoint?: string;
  currentSort?: string;
  onSortChange?: (sort: string) => void;
}) {
  const isActive = currentSort === sortOption;
  const isClickable = !!onSortChange;

  return (
    <SortableLabel
      breakpoint={breakpoint}
      align={align}
      isActive={isActive}
      isClickable={isClickable}
      onClick={isClickable ? () => onSortChange(sortOption) : undefined}
      style={{width}}
    >
      {label}
    </SortableLabel>
  );
}

function SortableHeaderText({
  sortOption,
  currentSort,
  onSortChange,
  children,
}: {
  children: React.ReactNode;
  sortOption: IssueSortOptions;
  currentSort?: string;
  onSortChange?: (sort: string) => void;
}) {
  const isActive = currentSort === sortOption;
  const isClickable = !!onSortChange;

  return (
    <SortableText
      isActive={isActive}
      isClickable={isClickable}
      onClick={isClickable ? () => onSortChange(sortOption) : undefined}
    >
      {children}
    </SortableText>
  );
}

export default Headers;

const GraphLabel = styled(IssueStreamHeaderLabel)`
  width: 175px;
  flex: 1;
  display: flex;
  justify-content: space-between;
  padding: 0;
`;

const GraphToggles = styled('div')`
  font-weight: ${p => p.theme.fontWeight.normal};
  margin-right: ${space(2)};
`;

const GraphToggle = styled('a')<{active: boolean}>`
  font-size: 13px;
  padding-left: ${space(1)};

  &,
  &:hover,
  &:focus,
  &:active {
    color: ${p =>
      p.active ? p.theme.tokens.content.primary : p.theme.tokens.content.disabled};
  }
`;

const SortableLabel = styled(IssueStreamHeaderLabel)<{
  isActive: boolean;
  isClickable: boolean;
}>`
  ${p =>
    p.isClickable &&
    `
    cursor: pointer;
    user-select: none;
    &:hover {
      color: ${p.theme.tokens.content.primary};
    }
  `}
  ${p =>
    p.isActive &&
    `
    color: ${p.theme.tokens.content.primary};
  `}
`;

const SortableText = styled('span')<{isActive: boolean; isClickable: boolean}>`
  ${p =>
    p.isClickable &&
    `
    cursor: pointer;
    user-select: none;
    &:hover {
      color: ${p.theme.tokens.content.primary};
    }
  `}
  ${p =>
    p.isActive &&
    `
    color: ${p.theme.tokens.content.primary};
  `}
`;

const PriorityLabel = styled(IssueStreamHeaderLabel)`
  width: 64px;
`;

const AssigneeLabel = styled(IssueStreamHeaderLabel)`
  width: 66px;
`;

// Reprocessing
const StartedColumn = styled(ToolbarHeader)`
  margin: 0 ${space(2)};
  ${p => p.theme.overflowEllipsis};
  width: 85px;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    width: 140px;
  }
`;

const EventsReprocessedColumn = styled(ToolbarHeader)`
  margin: 0 ${space(2)};
  ${p => p.theme.overflowEllipsis};
  width: 75px;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    width: 140px;
  }
`;

const ProgressColumn = styled(ToolbarHeader)`
  margin: 0 ${space(2)};

  display: none;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    display: block;
    width: 160px;
  }
`;
