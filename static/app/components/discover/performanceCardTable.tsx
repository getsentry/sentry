import {Fragment} from 'react';
import * as React from 'react';
import {Link} from 'react-router';
import styled from '@emotion/styled';
import {Location, LocationDescriptor, Query} from 'history';

import Alert from 'app/components/alert';
import LoadingIndicator from 'app/components/loadingIndicator';
import {PanelItem} from 'app/components/panels';
import PanelTable from 'app/components/panels/panelTable';
import {backend, frontend, mobile, serverless} from 'app/data/platformCategories';
import {IconArrow, IconWarning} from 'app/icons';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Organization, ReleaseProject} from 'app/types';
import {TableData, TableDataRow} from 'app/utils/discover/discoverQuery';
import EventView, {MetaType} from 'app/utils/discover/eventView';
import {getFieldRenderer} from 'app/utils/discover/fieldRenderers';
import {getAggregateAlias} from 'app/utils/discover/fields';
import {getDuration} from 'app/utils/formatters';
import {TableColumn} from 'app/views/eventsV2/table/types';
import {GridCell, GridCellNumber} from 'app/views/performance/styles';
import {TrendsDataEvents} from 'app/views/performance/trends/types';
import {DiscoverField} from 'app/views/releases/detail/overview/index';
import {performanceCardLabels} from 'app/views/releases/detail/utils';

const FRONTEND_PLATFORMS: string[] = [...frontend, ...mobile];
const BACKEND_PLATFORMS: string[] = [...backend, ...serverless];

type ReleaseTableDataRow = {
  [key: string]: React.ReactText;
};

export type ReleaseTableData = {
  data?: Array<ReleaseTableDataRow>;
  meta?: MetaType;
};

type Props = {
  eventView: EventView;
  releaseEventView: EventView;
  organization: Organization;
  project: ReleaseProject;
  location: Location;
  isLoading: boolean;
  tableData: TableData | TrendsDataEvents | null;
  releaseTableData: ReleaseTableData | null;
  columnOrder: TableColumn<React.ReactText>[];
  generateLink?: Record<
    string,
    (
      organization: Organization,
      tableRow: TableDataRow,
      query: Query
    ) => LocationDescriptor
  >;
};

class PerformanceCardTable extends React.PureComponent<Props> {
  renderRow(
    row: TableDataRow | object,
    rowIndex: number,
    columnOrder: TableColumn<React.ReactText>[],
    tableMeta: MetaType
  ): React.ReactNode[] {
    const {organization, location} = this.props;

    const resultsRow = columnOrder.map((column, index) => {
      const field = String(column.key);
      // TODO add a better abstraction for this in fieldRenderers.
      const fieldName = getAggregateAlias(field);
      const fieldType = tableMeta[fieldName];

      const fieldRenderer = getFieldRenderer(field, tableMeta);
      let rendered = fieldRenderer(row, {organization, location});

      const isNumeric = ['integer', 'number', 'duration'].includes(fieldType);
      const key = `${rowIndex}:${column.key}:${index}`;
      rendered = isNumeric ? (
        <GridCellNumber>{rendered}</GridCellNumber>
      ) : (
        <GridCell id="border">{rendered}</GridCell>
      );

      return <BodyCellContainer key={key}>{rendered}</BodyCellContainer>;
    });

    return resultsRow;
  }

  renderChangeRow(row: object) {
    const cells: any[] = [];

    Object.values(row).forEach(r => cells.push(r));

    const rendered = (
      <BodyCellContainer id="changeBody">
        {cells.map(cell => (
          <GridCellNumber key={cell} id={!cell ? 'changeBorder' : 'changeNoBorder'}>
            <StyledIconArrow
              direction={cell > 0 ? 'up' : 'down'}
              color={cell > 0 ? 'red300' : 'green300'}
              size="xs"
            />
            {cell.includes('-')
              ? cell.replace('-', '')
              : cell.includes('NaN')
              ? cell.replace('NaN', '0.00')
              : cell}
          </GridCellNumber>
        ))}
      </BodyCellContainer>
    );

    return rendered;
  }

  renderResults() {
    const {isLoading, tableData, releaseTableData, columnOrder, project} = this.props;
    let cells: React.ReactNode[] = [];
    let releaseCells: React.ReactNode[] = [];

    if (isLoading) {
      return cells;
    }
    if (!tableData || !tableData.meta || !tableData.data) {
      return cells;
    }

    if (!releaseTableData || !releaseTableData.meta || !releaseTableData?.data?.length) {
      if (FRONTEND_PLATFORMS.includes(project.platform as string)) {
        const noReleaseTableData = {
          data: [
            {
              user_misery_300: '',
              p75_measurements_fcp: '',
              p75_measurements_fid: '',
              p75_measurements_lcp: '',
              p75_measurements_cls: '',
              p75_spans_http: '',
              p75_spans_db: '',
              p75_spans_browser: '',
              p75_spans_resource: '',
            },
          ],
        };
        releaseTableData!.data = noReleaseTableData.data;
      } else if (BACKEND_PLATFORMS.includes(project.platform as string)) {
        const noReleaseTableData = {
          data: [
            {
              user_misery_300: '',
              apdex_300: '',
              p75_spans_http: '',
              p75_spans_db: '',
            },
          ],
        };
        releaseTableData!.data = noReleaseTableData.data;
      } else {
        const noReleaseTableData = {
          data: [
            {
              user_misery_300: '',
            },
          ],
        };
        releaseTableData!.data = noReleaseTableData.data;
      }
    }

    tableData.data.forEach((row, i: number) => {
      // Another check to appease tsc
      if (!tableData.meta) {
        return;
      }
      cells = cells.concat(this.renderRow(row, i, columnOrder, tableData.meta));
    });

    releaseTableData?.data.forEach((row, i: number) => {
      // Another check to appease tsc
      if (!releaseTableData?.meta) {
        return;
      }
      releaseCells = releaseCells.concat(
        this.renderRow(row, i, columnOrder, releaseTableData?.meta)
      );
    });
    return [cells, releaseCells];
  }

  renderChangeResults() {
    const {tableData, releaseTableData, project} = this.props;
    let changeCells: React.ReactNode[] = [];

    if (tableData?.data.length && releaseTableData?.data?.length) {
      if (FRONTEND_PLATFORMS.includes(project.platform as string)) {
        const userMiseryChange =
          +releaseTableData?.data[0].user_misery_300 -
          tableData?.data[0]['user_misery_300'];
        const fcpChange =
          +releaseTableData?.data[0].p75_measurements_fcp -
          tableData?.data[0]['p75_measurements_fcp'];
        const fidChange =
          +releaseTableData?.data[0].p75_measurements_fid -
          tableData?.data[0]['p75_measurements_fid'];
        const lcpChange =
          +releaseTableData?.data[0].p75_measurements_lcp -
          tableData?.data[0]['p75_measurements_lcp'];
        const clsChange =
          +releaseTableData?.data[0].p75_measurements_cls -
          tableData?.data[0]['p75_measurements_cls'];
        const httpChange =
          +releaseTableData?.data[0]['spans.http'] - tableData?.data[0]['p75_spans_http'];
        const dbChange =
          +releaseTableData?.data[0].p75_spans_db - tableData?.data[0]['p75_spans_db'];
        const browserChange =
          +releaseTableData?.data[0].p75_spans_browser -
          tableData?.data[0]['p75_spans_browser'];
        const resourceChange =
          +releaseTableData?.data[0].resource - tableData?.data[0]['p75_spans_resource'];

        const changeRow = {
          user_misery_300: userMiseryChange.toString(),
          webVitals: '',
          p75_measurements_fcp: getDuration(fcpChange / 1000, 2, true),
          p75_measurements_fid: getDuration(fidChange / 1000, 2, true),
          p75_measurements_lcp: getDuration(lcpChange / 1000, 2, true),
          p75_measurements_cls: clsChange.toString(),
          spanOperations: '',
          p75_spans_http: getDuration(httpChange / 1000, 2, true),
          p75_spans_db: getDuration(dbChange / 1000, 2, true),
          p75_spans_browser: getDuration(browserChange / 1000, 2, true),
          p75_spans_resource: getDuration(resourceChange / 1000, 2, true),
        };
        changeCells = changeCells.concat(this.renderChangeRow(changeRow));
      } else if (BACKEND_PLATFORMS.includes(project.platform as string)) {
        const userMiseryChange =
          +releaseTableData?.data[0].user_misery_300 -
          tableData?.data[0]['user_misery_300'];
        const apdexChange =
          +releaseTableData?.data[0].apdex_300 - tableData?.data[0]['apdex_300'];
        const httpChange =
          +releaseTableData?.data[0]['spans.http'] - tableData?.data[0]['p75_spans_http'];
        const dbChange =
          +releaseTableData?.data[0].p75_spans_db - tableData?.data[0]['p75_spans_db'];

        const changeRow = {
          user_misery_300: userMiseryChange.toString(),
          apdex_300: apdexChange.toString(),
          spanOperations: '',
          p75_spans_http: getDuration(httpChange / 1000, 2, true),
          p75_spans_db: getDuration(dbChange / 1000, 2, true),
        };
        changeCells = changeCells.concat(this.renderChangeRow(changeRow));
      } else {
        const userMiseryChange =
          +releaseTableData?.data[0].user_misery_300 -
          tableData?.data[0]['user_misery_300'];

        const changeRow = {
          user_misery_300: userMiseryChange.toString(),
        };
        changeCells = changeCells.concat(this.renderChangeRow(changeRow));
      }
    }
    return changeCells;
  }

  renderFrontendPerformance() {
    const {organization, releaseEventView} = this.props;
    const discoverPath = `/organizations/${organization.slug}/discover/results/`;

    return (
      <Fragment>
        <StyledPanelItem>
          <TopField>{performanceCardLabels.userMisery}</TopField>
          <SubTitle>{performanceCardLabels.webVitals}</SubTitle>
          <Field>
            <Link
              to={{
                pathname: discoverPath,
                query: {
                  query: `event.type:transaction ${releaseEventView.query}`,
                  project: `${releaseEventView.project}`,
                  field: DiscoverField.FIRST_CONTENTFUL_PAINT,
                  statsPeriod: `${releaseEventView.statsPeriod}`,
                },
              }}
            >
              {performanceCardLabels.firstContentfulPaint}
            </Link>
          </Field>
          <Field>
            <Link
              to={{
                pathname: discoverPath,
                query: {
                  query: `event.type:transaction ${releaseEventView.query}`,
                  project: `${releaseEventView.project}`,
                  field: DiscoverField.FIRST_INPUT_DELAY,
                  statsPeriod: `${releaseEventView.statsPeriod}`,
                },
              }}
            >
              {performanceCardLabels.firstInputDelay}
            </Link>
          </Field>
          <Field>
            <Link
              to={{
                pathname: discoverPath,
                query: {
                  query: `event.type:transaction ${releaseEventView.query}`,
                  project: `${releaseEventView.project}`,
                  field: DiscoverField.LARGEST_CONTENTFUL_PAINT,
                  statsPeriod: `${releaseEventView.statsPeriod}`,
                },
              }}
            >
              {performanceCardLabels.largestContentfulPaint}
            </Link>
          </Field>
          <Field>
            <Link
              to={{
                pathname: discoverPath,
                query: {
                  query: `event.type:transaction ${releaseEventView.query}`,
                  project: `${releaseEventView.project}`,
                  field: DiscoverField.CUMULATIVE_LAYOUT_SHIFT,
                  statsPeriod: `${releaseEventView.statsPeriod}`,
                },
              }}
            >
              {performanceCardLabels.cumulativeLayoutShift}
            </Link>
          </Field>
          <SubTitle>{performanceCardLabels.spanOperations}</SubTitle>
          <Field>
            <Link
              to={{
                pathname: discoverPath,
                query: {
                  query: `event.type:transaction ${releaseEventView.query}`,
                  project: `${releaseEventView.project}`,
                  field: DiscoverField.SPANS_HTTP,
                  statsPeriod: `${releaseEventView.statsPeriod}`,
                },
              }}
            >
              {performanceCardLabels.http}
            </Link>
          </Field>
          <Field>
            <Link
              to={{
                pathname: discoverPath,
                query: {
                  query: `event.type:transaction ${releaseEventView.query}`,
                  project: `${releaseEventView.project}`,
                  field: DiscoverField.SPANS_DB,
                  statsPeriod: `${releaseEventView.statsPeriod}`,
                },
              }}
            >
              {performanceCardLabels.db}
            </Link>
          </Field>
          <Field>
            <Link
              to={{
                pathname: discoverPath,
                query: {
                  query: `event.type:transaction ${releaseEventView.query}`,
                  project: `${releaseEventView.project}`,
                  field: DiscoverField.SPANS_BROWSER,
                  statsPeriod: `${releaseEventView.statsPeriod}`,
                },
              }}
            >
              {performanceCardLabels.browser}
            </Link>
          </Field>
          <Field>
            <Link
              to={{
                pathname: discoverPath,
                query: {
                  query: `event.type:transaction ${releaseEventView.query}`,
                  project: `${releaseEventView.project}`,
                  field: DiscoverField.SPANS_RESOURCE,
                  statsPeriod: `${releaseEventView.statsPeriod}`,
                },
              }}
            >
              {performanceCardLabels.resource}
            </Link>
          </Field>
        </StyledPanelItem>
        <StyledPanelItem>{this.renderResults()[0]}</StyledPanelItem>
        <StyledPanelItem>{this.renderResults()[1]}</StyledPanelItem>
        <StyledPanelItem>{this.renderChangeResults()}</StyledPanelItem>
      </Fragment>
    );
  }

  renderBackendPerformance() {
    const {organization, releaseEventView} = this.props;
    const discoverPath = `/organizations/${organization.slug}/discover/results/`;

    return (
      <Fragment>
        <BackEndStyledPanelItem>
          <BackEndTopField>{performanceCardLabels.userMisery}</BackEndTopField>
          <BackEndField>{performanceCardLabels.apdex}</BackEndField>
          <SubTitle>
            <span>{performanceCardLabels.spanOperations}</span>
          </SubTitle>
          <Field>
            <Link
              to={{
                pathname: discoverPath,
                query: {
                  query: `event.type:transaction ${releaseEventView.query}`,
                  project: `${releaseEventView.project}`,
                  field: DiscoverField.SPANS_HTTP,
                  statsPeriod: `${releaseEventView.statsPeriod}`,
                },
              }}
            >
              {performanceCardLabels.http}
            </Link>
          </Field>
          <Field>
            <Link
              to={{
                pathname: discoverPath,
                query: {
                  query: `event.type:transaction ${releaseEventView.query}`,
                  project: `${releaseEventView.project}`,
                  field: DiscoverField.SPANS_DB,
                  statsPeriod: `${releaseEventView.statsPeriod}`,
                },
              }}
            >
              {performanceCardLabels.db}
            </Link>
          </Field>
        </BackEndStyledPanelItem>
        <BackEndStyledPanelItem>{this.renderResults()[0]}</BackEndStyledPanelItem>
        <BackEndStyledPanelItem>{this.renderResults()[1]}</BackEndStyledPanelItem>
        <BackEndStyledPanelItem>{this.renderChangeResults()}</BackEndStyledPanelItem>
      </Fragment>
    );
  }

  renderUnknownPerformance() {
    return (
      <Fragment>
        <StyledPanelItem>
          <TopField>{'User Misery'}</TopField>
        </StyledPanelItem>
        <StyledPanelItem>{this.renderResults()[0]}</StyledPanelItem>
        <StyledPanelItem>{this.renderResults()[1]}</StyledPanelItem>
        <StyledPanelItem>{this.renderChangeResults()}</StyledPanelItem>
      </Fragment>
    );
  }

  render() {
    const {isLoading, tableData, releaseTableData, project, organization} = this.props;

    const hasResults =
      tableData && tableData.data && tableData.meta && tableData.data.length > 0;
    const hasReleaseResults =
      releaseTableData &&
      releaseTableData.data &&
      releaseTableData.meta &&
      releaseTableData.data.length > 0;
    // Custom set the height so we don't have layout shift when results are loaded.
    const loader = <LoadingIndicator style={{margin: '70px auto'}} />;
    const title = FRONTEND_PLATFORMS.includes(project.platform as string)
      ? 'Frontend Performance'
      : BACKEND_PLATFORMS.includes(project.platform as string)
      ? 'Backend Performance'
      : '[Unknown] Performance';

    return (
      <Fragment>
        <HeadCellContainer>{title}</HeadCellContainer>
        {title.includes('Unknown') ? (
          <StyledAlert type="warning" icon={<IconWarning size="md" />} system>
            For more performance metrics, specify which platform this project is using in{' '}
            <Link to={`/settings/${organization.slug}/projects/${project.slug}/`}>
              project settings.
            </Link>
          </StyledAlert>
        ) : null}
        <StyledPanelTable
          isEmpty={!hasResults && !hasReleaseResults}
          emptyMessage={t('No transactions found')}
          headers={[
            <Cell key="description" align="left">
              {t('Description')}
            </Cell>,
            <Cell key="releases" align="right">
              {t('All Releases')}
            </Cell>,
            <Cell key="release" align="right">
              {t('This Release')}
            </Cell>,
            <Cell key="change" align="right">
              {t('Change')}
            </Cell>,
          ]}
          isLoading={isLoading}
          disablePadding
          loader={loader}
          disableTopBorder={title.includes('Unknown')}
        >
          {FRONTEND_PLATFORMS.includes(project.platform as string)
            ? this.renderFrontendPerformance()
            : BACKEND_PLATFORMS.includes(project.platform as string)
            ? this.renderBackendPerformance()
            : this.renderUnknownPerformance()}
        </StyledPanelTable>
      </Fragment>
    );
  }
}

const HeadCellContainer = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  padding: ${space(2)};
  border-top: 1px solid ${p => p.theme.gray200};
  border-left: 1px solid ${p => p.theme.gray200};
  border-right: 1px solid ${p => p.theme.gray200};
  border-top-left-radius: ${p => p.theme.borderRadius};
  border-top-right-radius: ${p => p.theme.borderRadius};
`;

const BodyCellContainer = styled('div')`
  display: grid !important;
  grid-auto-rows: 1fr;
  font-size: ${p => p.theme.fontSizeLarge};

  ${GridCell}, ${GridCellNumber} {
    font-size: ${p => p.theme.fontSizeLarge};
    padding-right: ${space(2)};
  }

  #border,
  #changeBorder {
    border-top: 1px solid ${p => p.theme.gray200};
    svg,
    span {
      display: none;
    }
  }

  ${overflowEllipsis};
`;

const Field = styled('div')`
  margin-left: ${space(4)};
  font-size: ${p => p.theme.fontSizeLarge};
  ${overflowEllipsis};
`;

const StyledPanelTable = styled(PanelTable)<{disableTopBorder: boolean}>`
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  border-top: ${p => (p.disableTopBorder ? 'none' : `1px solid ${p.theme.gray200}`)};

  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: min-content 1fr 1fr 1fr;
  }
`;

const StyledPanelItem = styled(PanelItem)`
  display: grid;
  grid-auto-rows: 1fr;
  border-bottom: none;
  padding: ${space(2)} 0 0 !important;
`;

const BackEndStyledPanelItem = styled(PanelItem)`
  padding: 0 !important;
  display: grid;
  grid-auto-rows: 1fr;
  border-bottom: none;

  > *:nth-last-child(4) {
    border-top: 1px solid ${p => p.theme.gray200};
  }

  > *:nth-child(n + 4) {
    ${GridCell}, ${GridCellNumber} {
      padding-top: 0;
    }
  }

  > *:last-child {
    ${GridCell}, ${GridCellNumber} {
      :nth-child(2) {
        border-top: 1px solid ${p => p.theme.gray200};
      }
      :nth-child(n + 4) {
        padding-top: 0;
      }
    }
  }

  ${GridCell}, ${GridCellNumber} {
    padding-top: ${space(2)};
  }
`;

const SubTitle = styled('div')`
  border-top: 1px solid ${p => p.theme.gray200};
  padding-left: ${space(2)};
  padding-top: ${space(2)};

  span {
    padding-top: ${space(2)};
  }
`;

const TopField = styled('div')`
  margin-left: ${space(2)};
  padding-bottom: ${space(2)};
`;

const BackEndTopField = styled('div')`
  padding-left: ${space(2)};
  padding-top: ${space(2)};
  padding-bottom: ${space(2)};
`;

const BackEndField = styled('div')`
  display: block;
  font-size: ${p => p.theme.fontSizeLarge};
  padding: ${space(2)} 0 0 ${space(2)};
  ${overflowEllipsis};
`;

const Cell = styled('div')<{align: 'left' | 'right'}>`
  text-align: ${p => p.align};
  margin-left: ${p => p.align === 'left' && space(2)};
  padding-right: ${p => p.align === 'right' && space(2)};
  ${overflowEllipsis}
`;

const StyledIconArrow = styled(IconArrow)`
  margin-right: ${space(0.5)};
`;

const StyledAlert = styled(Alert)`
  border-top: 1px solid ${p => p.theme.gray200};
  border-right: 1px solid ${p => p.theme.gray200};
  border-left: 1px solid ${p => p.theme.gray200};
  margin-bottom: 0;
`;

export default PerformanceCardTable;
