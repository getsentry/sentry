import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import NotAvailable from 'sentry/components/notAvailable';
import Placeholder from 'sentry/components/placeholder';
import {Radio} from 'sentry/components/radio';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ReleaseComparisonChartType} from 'sentry/types/release';
import {defined} from 'sentry/utils';

import {releaseComparisonChartLabels} from '../../utils';

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

function ReleaseComparisonChartRow({
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
}: Props) {
  return (
    <ChartTableRow
      htmlFor={type}
      isActive={type === activeChart}
      isLoading={showPlaceholders}
      role={role}
      expanded={expanded}
    >
      <DescriptionCell>
        <TitleWrapper>
          <Radio
            id={type}
            disabled={false}
            checked={type === activeChart}
            onChange={() => onChartChange(type)}
          />
          {releaseComparisonChartLabels[type]}&nbsp;{drilldown}
        </TitleWrapper>
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
              borderless
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

const Cell = styled('div')`
  text-align: right;
  color: ${p => p.theme.subText};
  ${p => p.theme.overflowEllipsis}
  font-size: ${p => p.theme.fontSizeMedium};
`;

const NumericCell = styled(Cell)`
  font-variant-numeric: tabular-nums;
`;

const DescriptionCell = styled(Cell)`
  text-align: left;
  overflow: visible;
  color: ${p => p.theme.textColor};
`;

const ExpanderCell = styled(Cell)`
  display: flex;
  align-items: center;
  justify-content: flex-end;
`;

const TitleWrapper = styled('div')`
  display: flex;
  align-items: center;
  position: relative;
  z-index: 1;
  background: ${p => p.theme.background};

  input {
    width: ${space(2)};
    height: ${space(2)};
    flex-shrink: 0;
    background-color: ${p => p.theme.background};
    margin-right: ${space(1)} !important;

    &:checked:after {
      width: ${space(1)};
      height: ${space(1)};
    }

    &:hover {
      cursor: pointer;
    }
  }
`;

const ChartTableRow = styled('label')<{
  expanded: boolean;
  isActive: boolean;
  isLoading: boolean;
  role: ReleaseComparisonRow['role'];
}>`
  display: contents;
  font-weight: ${p => p.theme.fontWeightNormal};
  margin-bottom: 0;

  > * {
    padding: ${space(1)} ${space(2)};
  }

  ${p =>
    p.isActive &&
    !p.isLoading &&
    css`
      ${Cell}, ${NumericCell}, ${DescriptionCell}, ${TitleWrapper}, ${ExpanderCell} {
        background-color: ${p.theme.bodyBackground};
      }
    `}

  &:hover {
    cursor: pointer;
    ${Cell}, ${NumericCell}, ${DescriptionCell}, ${ExpanderCell}, ${TitleWrapper} {
      ${p => !p.isLoading && `background-color: ${p.theme.bodyBackground}`}
    }
  }

  ${p =>
    (p.role === 'default' || (p.role === 'parent' && !p.expanded)) &&
    css`
      &:not(:last-child) {
        ${Cell}, ${NumericCell}, ${DescriptionCell}, ${ExpanderCell} {
          border-bottom: 1px solid ${p.theme.border};
        }
      }
    `}

  ${p =>
    p.role === 'children' &&
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
          border-bottom: 1px solid ${p.theme.border};
          border-left: 1px solid ${p.theme.border};
        }
      }
    `}

    ${p =>
    p.role === 'children' &&
    css`
      ${Cell}, ${NumericCell}, ${DescriptionCell}, ${ExpanderCell} {
        padding-bottom: ${space(0.75)};
        padding-top: ${space(0.75)};
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

export default ReleaseComparisonChartRow;
