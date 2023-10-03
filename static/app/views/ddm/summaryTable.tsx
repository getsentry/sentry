import {Fragment} from 'react';
import styled from '@emotion/styled';
import colorFn from 'color';

import {LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {Tooltip} from 'sentry/components/tooltip';
import {IconLightning, IconReleases} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getUtcDateString} from 'sentry/utils/dates';
import {formatMetricsUsingUnitAndOp, getNameFromMRI} from 'sentry/utils/metrics';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {Series} from 'sentry/views/ddm/metricWidget';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';

export function SummaryTable({
  series,
  operation,
  onClick,
  setHoveredLegend,
}: {
  onClick: (seriesName: string) => void;
  series: Series[];
  setHoveredLegend: React.Dispatch<React.SetStateAction<string>> | undefined;
  operation?: string;
}) {
  const {selection} = usePageFilters();
  const router = useRouter();
  const {slug} = useOrganization();
  const hasActions = series.some(s => s.release || s.transaction);
  const {start, end, statsPeriod, project, environment} = router.location.query;

  const releaseTo = (release: string) => {
    return {
      pathname: `/organizations/${slug}/releases/${encodeURIComponent(release)}/`,
      query: {
        start,
        end,
        pageStatsPeriod: statsPeriod,
        project,
        environment,
      },
    };
  };

  const transactionTo = (transaction: string) =>
    transactionSummaryRouteWithQuery({
      orgSlug: slug,
      transaction,
      projectID: selection.projects.map(p => String(p)),
      query: {
        query: '',
        environment: selection.environments,
        start: selection.datetime.start
          ? getUtcDateString(selection.datetime.start)
          : undefined,
        end: selection.datetime.end
          ? getUtcDateString(selection.datetime.end)
          : undefined,
        statsPeriod: selection.datetime.period,
      },
    });

  return (
    <SummaryTableWrapper hasActions={hasActions}>
      <HeaderCell />
      <HeaderCell>{t('Name')}</HeaderCell>
      <HeaderCell right>{t('Avg')}</HeaderCell>
      <HeaderCell right>{t('Min')}</HeaderCell>
      <HeaderCell right>{t('Max')}</HeaderCell>
      <HeaderCell right>{t('Sum')}</HeaderCell>
      {hasActions && <HeaderCell right>{t('Actions')}</HeaderCell>}

      {series
        .sort((a, b) => a.seriesName.localeCompare(b.seriesName))
        .map(({seriesName, color, hidden, unit, data, transaction, release}) => {
          const {avg, min, max, sum} = getValues(data);

          return (
            <Fragment key={seriesName}>
              <CellWrapper
                onClick={() => onClick(seriesName)}
                onMouseEnter={() => setHoveredLegend?.(seriesName)}
                onMouseLeave={() => setHoveredLegend?.('')}
              >
                <Cell>
                  <ColorDot color={color} isHidden={!!hidden} />
                </Cell>
                <Cell>{getNameFromMRI(seriesName)}</Cell>
                {/* TODO(ddm): Add a tooltip with the full value, don't add on click in case users want to copy the value */}
                <Cell right>{formatMetricsUsingUnitAndOp(avg, unit, operation)}</Cell>
                <Cell right>{formatMetricsUsingUnitAndOp(min, unit, operation)}</Cell>
                <Cell right>{formatMetricsUsingUnitAndOp(max, unit, operation)}</Cell>
                <Cell right>{formatMetricsUsingUnitAndOp(sum, unit, operation)}</Cell>
              </CellWrapper>
              {hasActions && (
                <Cell right>
                  <ButtonBar gap={0.5}>
                    {transaction && (
                      <div>
                        <Tooltip title={t('Open Transaction Summary')}>
                          <LinkButton to={transactionTo(transaction)} size="xs">
                            <IconLightning size="xs" />
                          </LinkButton>
                        </Tooltip>
                      </div>
                    )}

                    {release && (
                      <div>
                        <Tooltip title={t('Open Release Details')}>
                          <LinkButton to={releaseTo(release)} size="xs">
                            <IconReleases size="xs" />
                          </LinkButton>
                        </Tooltip>
                      </div>
                    )}
                  </ButtonBar>
                </Cell>
              )}
            </Fragment>
          );
        })}
    </SummaryTableWrapper>
  );
}

function getValues(seriesData: Series['data']) {
  if (!seriesData) {
    return {min: null, max: null, avg: null, sum: null};
  }

  const res = seriesData.reduce(
    (acc, {value}) => {
      if (value === null) {
        return acc;
      }

      acc.min = Math.min(acc.min, value);
      acc.max = Math.max(acc.max, value);
      acc.sum += value;

      return acc;
    },
    {min: Infinity, max: -Infinity, sum: 0}
  );

  return {...res, avg: res.sum / seriesData.length};
}

// TODO(ddm): PanelTable component proved to be a bit too opinionated for this use case,
// so we're using a custom styled component instead. Figure out what we want to do here
const SummaryTableWrapper = styled(`div`)<{hasActions: boolean}>`
  display: grid;
  grid-template-columns: ${p =>
    p.hasActions ? '24px 8fr 1fr 1fr 1fr 1fr 1fr' : '24px 8fr 1fr 1fr 1fr 1fr'};
`;

// TODO(ddm): This is a copy of PanelTableHeader, try to figure out how to reuse it
const HeaderCell = styled('div')<{right?: boolean}>`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
  text-transform: uppercase;
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  line-height: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: ${p => (p.right ? 'right' : 'left')};
  padding: ${space(0.5)} ${space(1)};
`;

const Cell = styled('div')<{right?: boolean}>`
  display: flex;
  padding: ${space(0.25)} ${space(1)};
  align-items: center;
  justify-content: ${p => (p.right ? 'flex-end' : 'flex-start')};
`;

const ColorDot = styled(`div`)<{color: string; isHidden: boolean}>`
  background-color: ${p =>
    p.isHidden ? 'transparent' : colorFn(p.color).alpha(1).string()};
  border: 1px solid ${p => p.color};
  border-radius: 50%;
  width: ${space(1)};
  height: ${space(1)};
`;

const CellWrapper = styled('div')`
  display: contents;
  &:hover {
    cursor: pointer;
    ${Cell} {
      background-color: ${p => p.theme.bodyBackground};
    }
  }
`;
