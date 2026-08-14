import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Radio} from '@sentry/scraps/radio';
import {Tooltip} from '@sentry/scraps/tooltip';

import {NotAvailable} from 'sentry/components/notAvailable';
import {Placeholder} from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {ReleaseComparisonChartType} from 'sentry/types/release';
import {defined} from 'sentry/utils/defined';
import {releaseComparisonChartLabels} from 'sentry/views/explore/releases/detail/utils';

import type {ReleaseComparisonRow} from '.';

type Props = Omit<ReleaseComparisonRow, 'diffDirection' | 'diffColor'> & {
  activeChart: ReleaseComparisonChartType;
  chartDiff: React.ReactNode;
  expanded: boolean;
  onChartChange: (type: ReleaseComparisonChartType) => void;
  onExpanderToggle: (type: ReleaseComparisonChartType) => void;
  showPlaceholders: boolean;
  withExpanders: boolean;
};

export function ReleaseComparisonChartRow({
  type,
  role,
  drilldown,
  thisRelease,
  allReleases,
  diff,
  showPlaceholders,
  activeChart,
  chartDiff,
  onChartChange,
  onExpanderToggle,
  expanded,
  withExpanders,
  tooltip,
}: Props) {
  return (
    <ChartTableRow
      isActive={type === activeChart}
      isLoading={showPlaceholders}
      rowRole={role}
      expanded={expanded}
      onClick={event => {
        // Nested controls own their own click, the way they did when the row was a label
        if ((event.target as HTMLElement).closest('a, button, input, label')) {
          return;
        }
        onChartChange(type);
      }}
    >
      <DescriptionCell>
        <Tooltip disabled={!tooltip} title={tooltip} showUnderline>
          <TitleWrapper htmlFor={type}>
            <Radio
              id={type}
              disabled={false}
              checked={type === activeChart}
              onChange={() => onChartChange(type)}
            />
            {releaseComparisonChartLabels[type]}
          </TitleWrapper>
        </Tooltip>
        {drilldown ? (
          <Flex gap="md" paddingLeft="2xl">
            {drilldown}
          </Flex>
        ) : null}
      </DescriptionCell>
      <NumericCell>
        {showPlaceholders ? (
          <Placeholder height="20px" />
        ) : defined(allReleases) ? (
          allReleases
        ) : (
          <NotAvailable />
        )}
      </NumericCell>
      <NumericCell>
        {showPlaceholders ? (
          <Placeholder height="20px" />
        ) : defined(thisRelease) ? (
          thisRelease
        ) : (
          <NotAvailable />
        )}
      </NumericCell>
      <NumericCell>
        {showPlaceholders ? (
          <Placeholder height="20px" />
        ) : defined(diff) ? (
          chartDiff
        ) : (
          <NotAvailable />
        )}
      </NumericCell>
      {withExpanders && (
        <ExpanderCell>
          {role === 'parent' && (
            <ToggleButton
              onClick={() => onExpanderToggle(type)}
              variant="transparent"
              size="zero"
              icon={<IconChevron direction={expanded ? 'up' : 'down'} />}
              aria-label={t('Toggle chart group')}
            />
          )}
        </ExpanderCell>
      )}
    </ChartTableRow>
  );
}

const Cell = styled(SimpleTable.RowCell)`
  text-align: right;
  color: ${p => p.theme.tokens.content.secondary};
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: ${p => p.theme.font.size.md};
`;

const NumericCell = styled(Cell)`
  font-variant-numeric: tabular-nums;
`;

const DescriptionCell = styled(Cell)`
  text-align: left;
  overflow: visible;
  color: ${p => p.theme.tokens.content.primary};
`;

const ExpanderCell = styled(Cell)`
  display: flex;
  align-items: center;
  justify-content: flex-end;
`;

const TitleWrapper = styled('label')`
  display: flex;
  align-items: center;
  position: relative;
  z-index: 1;
  background: ${p => p.theme.tokens.background.primary};

  input {
    width: ${p => p.theme.space.xl};
    height: ${p => p.theme.space.xl};
    flex-shrink: 0;
    background-color: ${p => p.theme.tokens.background.primary};
    margin-right: ${p => p.theme.space.md} !important;

    &:checked:after {
      width: ${p => p.theme.space.md};
      height: ${p => p.theme.space.md};
    }

    &:hover {
      cursor: pointer;
    }
  }
`;

const ChartTableRow = styled(SimpleTable.Row, {
  shouldForwardProp: prop =>
    prop !== 'expanded' &&
    prop !== 'isActive' &&
    prop !== 'isLoading' &&
    prop !== 'rowRole',
})<{
  expanded: boolean;
  isActive: boolean;
  isLoading: boolean;
  rowRole: ReleaseComparisonRow['role'];
}>`
  font-weight: ${p => p.theme.font.weight.sans.regular};
  margin-bottom: 0;

  > * {
    padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  }

  ${p =>
    p.isActive &&
    !p.isLoading &&
    css`
      ${Cell}, ${NumericCell}, ${DescriptionCell}, ${TitleWrapper}, ${ExpanderCell} {
        background-color: ${p.theme.tokens.background.secondary};
      }
    `}

  &:hover {
    cursor: pointer;
    ${Cell}, ${NumericCell}, ${DescriptionCell}, ${ExpanderCell}, ${TitleWrapper} {
      ${p => !p.isLoading && `background-color: ${p.theme.tokens.background.secondary}`}
    }
  }

  ${p =>
    (p.rowRole === 'default' || (p.rowRole === 'parent' && !p.expanded)) &&
    css`
      &:not(:last-child) {
        ${Cell}, ${NumericCell}, ${DescriptionCell}, ${ExpanderCell} {
          border-bottom: 1px solid ${p.theme.tokens.border.primary};
        }
      }
    `}

  ${p =>
    p.rowRole === 'children' &&
    css`
      ${DescriptionCell} {
        padding-left: 44px;
        position: relative;
        &:before {
          content: '';
          width: 15px;
          height: 36px;
          position: absolute;
          top: -17px;
          left: 24px;
          border-bottom: 1px solid ${p.theme.tokens.border.primary};
          border-left: 1px solid ${p.theme.tokens.border.primary};
        }
      }
    `}

  ${p =>
    p.rowRole === 'children' &&
    css`
      ${Cell}, ${NumericCell}, ${DescriptionCell}, ${ExpanderCell} {
        padding-bottom: ${p.theme.space.sm};
        padding-top: ${p.theme.space.sm};
        border-bottom: 0;
      }
    `}
`;

const ToggleButton = styled(Button)`
  &,
  &:hover,
  &:focus,
  &:active {
    background: transparent;
  }
`;
