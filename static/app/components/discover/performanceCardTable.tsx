import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Alert} from 'sentry/components/alert';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NotAvailable from 'sentry/components/notAvailable';
import PanelItem from 'sentry/components/panels/panelItem';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {IconArrow} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {ReleaseProject} from 'sentry/types/release';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import type EventView from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {MobileVital, WebVital} from 'sentry/utils/fields';
import {
  MOBILE_VITAL_DETAILS,
  WEB_VITAL_DETAILS,
} from 'sentry/utils/performance/vitals/constants';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import {ProjectPerformanceType} from 'sentry/views/performance/utils';

type PerformanceCardTableProps = {
  allReleasesEventView: EventView;
  allReleasesTableData: TableData | null;
  isLoading: boolean;
  location: Location;
  organization: Organization;
  performanceType: ProjectPerformanceType;
  project: ReleaseProject;
  releaseEventView: EventView;
  thisReleaseTableData: TableData | null;
};

function PerformanceCardTable({
  organization,
  location,
  project,
  releaseEventView,
  allReleasesTableData,
  thisReleaseTableData,
  performanceType,
  isLoading,
}: PerformanceCardTableProps) {
  const miseryRenderer =
    allReleasesTableData?.meta &&
    getFieldRenderer('user_misery()', allReleasesTableData.meta, false);

  function renderChange(
    allReleasesScore: number,
    thisReleaseScore: number,
    meta: string
  ) {
    if (allReleasesScore === undefined || thisReleaseScore === undefined) {
      return <StyledNotAvailable />;
    }

    const trend = allReleasesScore - thisReleaseScore;
    const trendSeconds = trend >= 1000 ? trend / 1000 : trend;
    const trendPercentage = (allReleasesScore - thisReleaseScore) * 100;
    const valPercentage = Math.round(Math.abs(trendPercentage));
    const val = Math.abs(trendSeconds).toFixed(2);

    if (trend === 0) {
      return <SubText>{`0${meta === 'duration' ? 'ms' : '%'}`}</SubText>;
    }

    return (
      <TrendText color={trend >= 0 ? 'success' : 'error'}>
        {`${meta === 'duration' ? val : valPercentage}${
          meta === 'duration' ? (trend >= 1000 ? 's' : 'ms') : '%'
        }`}
        <StyledIconArrow
          color={trend >= 0 ? 'success' : 'error'}
          direction={trend >= 0 ? 'down' : 'up'}
          size="xs"
        />
      </TrendText>
    );
  }

  function userMiseryTrend() {
    const allReleasesUserMisery = allReleasesTableData?.data?.[0]?.['user_misery()'];
    const thisReleaseUserMisery = thisReleaseTableData?.data?.[0]?.['user_misery()'];
    return (
      <StyledPanelItem>
        {renderChange(
          allReleasesUserMisery as number,
          thisReleaseUserMisery as number,
          'number' as string
        )}
      </StyledPanelItem>
    );
  }

  function renderFrontendPerformance() {
    const webVitals = [
      {title: WebVital.FCP, field: 'p75(measurements.fcp)'},
      {title: WebVital.FID, field: 'p75(measurements.fid)'},
      {title: WebVital.LCP, field: 'p75(measurements.lcp)'},
      {title: WebVital.CLS, field: 'p75(measurements.cls)'},
    ];

    const spans = [
      {title: 'HTTP', column: 'p75(spans.http)', field: 'p75(spans.http)'},
      {title: 'Browser', column: 'p75(spans.browser)', field: 'p75(spans.browser)'},
      {title: 'Resource', column: 'p75(spans.resource)', field: 'p75(spans.resource)'},
    ];

    const webVitalTitles = webVitals.map((vital, idx) => {
      const newView = releaseEventView.withColumns([
        {kind: 'field', field: `p75(${vital.title})`},
      ]);
      return (
        <SubTitle key={idx}>
          <Link
            to={newView.getResultsViewUrlTarget(
              organization.slug,
              false,
              hasDatasetSelector(organization)
                ? SavedQueryDatasets.TRANSACTIONS
                : undefined
            )}
          >
            {WEB_VITAL_DETAILS[vital.title].name} (
            {WEB_VITAL_DETAILS[vital.title].acronym})
          </Link>
        </SubTitle>
      );
    });

    const spanTitles = spans.map((span, idx) => {
      const newView = releaseEventView.withColumns([
        {kind: 'field', field: `${span.column}`},
      ]);
      return (
        <SubTitle key={idx}>
          <Link
            to={newView.getResultsViewUrlTarget(
              organization.slug,
              false,
              hasDatasetSelector(organization)
                ? SavedQueryDatasets.TRANSACTIONS
                : undefined
            )}
          >
            {span.title}
          </Link>
        </SubTitle>
      );
    });

    const webVitalsRenderer = webVitals.map(
      vital =>
        allReleasesTableData?.meta &&
        getFieldRenderer(vital.field, allReleasesTableData?.meta, false)
    );

    const spansRenderer = spans.map(
      span =>
        allReleasesTableData?.meta &&
        getFieldRenderer(span.field, allReleasesTableData?.meta, false)
    );

    const webReleaseTrend = webVitals.map(vital => {
      return {
        allReleasesRow: {
          data: allReleasesTableData?.data?.[0]?.[vital.field],
          meta: allReleasesTableData?.meta?.[vital.field],
        },
        thisReleaseRow: {
          data: thisReleaseTableData?.data?.[0]?.[vital.field],
          meta: thisReleaseTableData?.meta?.[vital.field],
        },
      };
    });
    const spansReleaseTrend = spans.map(span => {
      return {
        allReleasesRow: {
          data: allReleasesTableData?.data?.[0]?.[span.field],
          meta: allReleasesTableData?.meta?.[span.field],
        },
        thisReleaseRow: {
          data: thisReleaseTableData?.data?.[0]?.[span.field],
          meta: thisReleaseTableData?.meta?.[span.field],
        },
      };
    });

    const emptyColumn = (
      <div>
        <SingleEmptySubText>
          <StyledNotAvailable tooltip={t('No results found')} />
        </SingleEmptySubText>
        <StyledPanelItem>
          <TitleSpace />
          {webVitals.map((vital, index) => (
            // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            <MultipleEmptySubText key={vital[index]}>
              <StyledNotAvailable tooltip={t('No results found')} />
            </MultipleEmptySubText>
          ))}
        </StyledPanelItem>
        <StyledPanelItem>
          <TitleSpace />
          {spans.map((span, index) => (
            // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            <MultipleEmptySubText key={span[index]}>
              <StyledNotAvailable tooltip={t('No results found')} />
            </MultipleEmptySubText>
          ))}
        </StyledPanelItem>
      </div>
    );

    return (
      <Fragment>
        <div>
          <PanelItem>{t('User Misery')}</PanelItem>
          <StyledPanelItem>
            <div>{t('Web Vitals')}</div>
            {webVitalTitles}
          </StyledPanelItem>
          <StyledPanelItem>
            <div>{t('Span Operations')}</div>
            {spanTitles}
          </StyledPanelItem>
        </div>
        {allReleasesTableData?.data.length === 0
          ? emptyColumn
          : allReleasesTableData?.data.map((dataRow, idx) => {
              const allReleasesMisery = miseryRenderer?.(dataRow, {
                organization,
                location,
              });
              const allReleasesWebVitals = webVitalsRenderer?.map(renderer =>
                renderer?.(dataRow, {organization, location})
              );
              const allReleasesSpans = spansRenderer?.map(renderer =>
                renderer?.(dataRow, {organization, location})
              );

              return (
                <div key={idx}>
                  <UserMiseryPanelItem>{allReleasesMisery}</UserMiseryPanelItem>
                  <StyledPanelItem>
                    <TitleSpace />
                    {allReleasesWebVitals.map(webVital => webVital)}
                  </StyledPanelItem>
                  <StyledPanelItem>
                    <TitleSpace />
                    {allReleasesSpans.map(span => span)}
                  </StyledPanelItem>
                </div>
              );
            })}
        {thisReleaseTableData?.data.length === 0
          ? emptyColumn
          : thisReleaseTableData?.data.map((dataRow, idx) => {
              const thisReleasesMisery = miseryRenderer?.(dataRow, {
                organization,
                location,
              });
              const thisReleasesWebVitals = webVitalsRenderer?.map(renderer =>
                renderer?.(dataRow, {organization, location})
              );
              const thisReleasesSpans = spansRenderer?.map(renderer =>
                renderer?.(dataRow, {organization, location})
              );

              return (
                <div key={idx}>
                  <div>
                    <UserMiseryPanelItem>{thisReleasesMisery}</UserMiseryPanelItem>
                    <StyledPanelItem>
                      <TitleSpace />
                      {thisReleasesWebVitals.map(webVital => webVital)}
                    </StyledPanelItem>
                    <StyledPanelItem>
                      <TitleSpace />
                      {thisReleasesSpans.map(span => span)}
                    </StyledPanelItem>
                  </div>
                </div>
              );
            })}
        <div>
          {userMiseryTrend()}
          <StyledPanelItem>
            <TitleSpace />
            {webReleaseTrend?.map(row =>
              renderChange(
                row.allReleasesRow?.data as number,
                row.thisReleaseRow?.data as number,
                row.allReleasesRow?.meta as string
              )
            )}
          </StyledPanelItem>
          <StyledPanelItem>
            <TitleSpace />
            {spansReleaseTrend?.map(row =>
              renderChange(
                row.allReleasesRow?.data as number,
                row.thisReleaseRow?.data as number,
                row.allReleasesRow?.meta as string
              )
            )}
          </StyledPanelItem>
        </div>
      </Fragment>
    );
  }

  function renderBackendPerformance() {
    const spans = [
      {title: 'HTTP', column: 'p75(spans.http)', field: 'p75_spans_http'},
      {title: 'DB', column: 'p75(spans.db)', field: 'p75_spans_db'},
    ];

    const spanTitles = spans.map((span, idx) => {
      const newView = releaseEventView.withColumns([
        {kind: 'field', field: `${span.column}`},
      ]);
      return (
        <SubTitle key={idx}>
          <Link
            to={newView.getResultsViewUrlTarget(
              organization.slug,
              false,
              hasDatasetSelector(organization)
                ? SavedQueryDatasets.TRANSACTIONS
                : undefined
            )}
          >
            {span.title}
          </Link>
        </SubTitle>
      );
    });

    const apdexRenderer =
      allReleasesTableData?.meta &&
      getFieldRenderer('apdex', allReleasesTableData.meta, false);

    const spansRenderer = spans.map(
      span =>
        allReleasesTableData?.meta &&
        getFieldRenderer(span.field, allReleasesTableData?.meta, false)
    );

    const spansReleaseTrend = spans.map(span => {
      return {
        allReleasesRow: {
          data: allReleasesTableData?.data?.[0]?.[span.field],
          meta: allReleasesTableData?.meta?.[span.field],
        },
        thisReleaseRow: {
          data: thisReleaseTableData?.data?.[0]?.[span.field],
          meta: thisReleaseTableData?.meta?.[span.field],
        },
      };
    });

    function apdexTrend() {
      const allReleasesApdex = allReleasesTableData?.data?.[0]?.apdex;
      const thisReleaseApdex = thisReleaseTableData?.data?.[0]?.apdex;
      return (
        <StyledPanelItem>
          {renderChange(
            allReleasesApdex as number,
            thisReleaseApdex as number,
            'string' as string
          )}
        </StyledPanelItem>
      );
    }

    const emptyColumn = (
      <div>
        <SingleEmptySubText>
          <StyledNotAvailable tooltip={t('No results found')} />
        </SingleEmptySubText>
        <SingleEmptySubText>
          <StyledNotAvailable tooltip={t('No results found')} />
        </SingleEmptySubText>
        <StyledPanelItem>
          <TitleSpace />
          {spans.map((span, index) => (
            // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            <MultipleEmptySubText key={span[index]}>
              <StyledNotAvailable tooltip={t('No results found')} />
            </MultipleEmptySubText>
          ))}
        </StyledPanelItem>
      </div>
    );
    return (
      <Fragment>
        <div>
          <PanelItem>{t('User Misery')}</PanelItem>
          <StyledPanelItem>
            <div>{t('Apdex')}</div>
          </StyledPanelItem>
          <StyledPanelItem>
            <div>{t('Span Operations')}</div>
            {spanTitles}
          </StyledPanelItem>
        </div>
        {allReleasesTableData?.data.length === 0
          ? emptyColumn
          : allReleasesTableData?.data.map((dataRow, idx) => {
              const allReleasesMisery = miseryRenderer?.(dataRow, {
                organization,
                location,
              });
              const allReleasesApdex = apdexRenderer?.(dataRow, {organization, location});
              const allReleasesSpans = spansRenderer?.map(renderer =>
                renderer?.(dataRow, {organization, location})
              );

              return (
                <div key={idx}>
                  <UserMiseryPanelItem>{allReleasesMisery}</UserMiseryPanelItem>
                  <ApdexPanelItem>{allReleasesApdex}</ApdexPanelItem>
                  <StyledPanelItem>
                    <TitleSpace />
                    {allReleasesSpans.map(span => span)}
                  </StyledPanelItem>
                </div>
              );
            })}
        {thisReleaseTableData?.data.length === 0
          ? emptyColumn
          : thisReleaseTableData?.data.map((dataRow, idx) => {
              const thisReleasesMisery = miseryRenderer?.(dataRow, {
                organization,
                location,
              });
              const thisReleasesApdex = apdexRenderer?.(dataRow, {
                organization,
                location,
              });
              const thisReleasesSpans = spansRenderer?.map(renderer =>
                renderer?.(dataRow, {organization, location})
              );

              return (
                <div key={idx}>
                  <UserMiseryPanelItem>{thisReleasesMisery}</UserMiseryPanelItem>
                  <ApdexPanelItem>{thisReleasesApdex}</ApdexPanelItem>
                  <StyledPanelItem>
                    <TitleSpace />
                    {thisReleasesSpans.map(span => span)}
                  </StyledPanelItem>
                </div>
              );
            })}
        <div>
          {userMiseryTrend()}
          {apdexTrend()}
          <StyledPanelItem>
            <TitleSpace />
            {spansReleaseTrend?.map(row =>
              renderChange(
                row.allReleasesRow?.data as number,
                row.thisReleaseRow?.data as number,
                row.allReleasesRow?.meta as string
              )
            )}
          </StyledPanelItem>
        </div>
      </Fragment>
    );
  }

  function renderMobilePerformance() {
    const mobileVitals = [
      MobileVital.APP_START_COLD,
      MobileVital.APP_START_WARM,
      MobileVital.FRAMES_SLOW,
      MobileVital.FRAMES_FROZEN,
    ];
    const mobileVitalTitles = mobileVitals.map(mobileVital => {
      return (
        <PanelItem key={mobileVital}>{MOBILE_VITAL_DETAILS[mobileVital].name}</PanelItem>
      );
    });

    const mobileVitalFields = [
      'p75(measurements.app_start_cold)',
      'p75(measurements.app_start_warm)',
      'p75(measurements.frames_slow)',
      'p75(measurements.frames_frozen)',
    ];
    const mobileVitalsRenderer = mobileVitalFields.map(
      field =>
        allReleasesTableData?.meta &&
        getFieldRenderer(field, allReleasesTableData?.meta, false)
    );

    const mobileReleaseTrend = mobileVitalFields.map(field => {
      return {
        allReleasesRow: {
          data: allReleasesTableData?.data?.[0]?.[field],
          meta: allReleasesTableData?.meta?.[field],
        },
        thisReleaseRow: {
          data: thisReleaseTableData?.data?.[0]?.[field],
          meta: thisReleaseTableData?.meta?.[field],
        },
      };
    });

    const emptyColumn = (
      <div>
        <SingleEmptySubText>
          <StyledNotAvailable tooltip={t('No results found')} />
        </SingleEmptySubText>
        {mobileVitalFields.map((vital, index) => (
          <SingleEmptySubText key={vital[index]}>
            <StyledNotAvailable tooltip={t('No results found')} />
          </SingleEmptySubText>
        ))}
      </div>
    );

    return (
      <Fragment>
        <div>
          <PanelItem>{t('User Misery')}</PanelItem>
          {mobileVitalTitles}
        </div>
        {allReleasesTableData?.data.length === 0
          ? emptyColumn
          : allReleasesTableData?.data.map((dataRow, idx) => {
              const allReleasesMisery = miseryRenderer?.(dataRow, {
                organization,
                location,
              });
              const allReleasesMobile = mobileVitalsRenderer?.map(renderer =>
                renderer?.(dataRow, {organization, location})
              );

              return (
                <div key={idx}>
                  <UserMiseryPanelItem>{allReleasesMisery}</UserMiseryPanelItem>
                  {allReleasesMobile.map((mobileVital, i) => (
                    <StyledPanelItem key={i}>{mobileVital}</StyledPanelItem>
                  ))}
                </div>
              );
            })}
        {thisReleaseTableData?.data.length === 0
          ? emptyColumn
          : thisReleaseTableData?.data.map((dataRow, idx) => {
              const thisReleasesMisery = miseryRenderer?.(dataRow, {
                organization,
                location,
              });
              const thisReleasesMobile = mobileVitalsRenderer?.map(renderer =>
                renderer?.(dataRow, {organization, location})
              );

              return (
                <div key={idx}>
                  <UserMiseryPanelItem>{thisReleasesMisery}</UserMiseryPanelItem>
                  {thisReleasesMobile.map((mobileVital, i) => (
                    <StyledPanelItem key={i}>{mobileVital}</StyledPanelItem>
                  ))}
                </div>
              );
            })}
        <div>
          {userMiseryTrend()}
          {mobileReleaseTrend?.map((row, idx) => (
            <StyledPanelItem key={idx}>
              {renderChange(
                row.allReleasesRow?.data as number,
                row.thisReleaseRow?.data as number,
                row.allReleasesRow?.meta as string
              )}
            </StyledPanelItem>
          ))}
        </div>
      </Fragment>
    );
  }

  function renderUnknownPerformance() {
    const emptyColumn = (
      <div>
        <SingleEmptySubText>
          <StyledNotAvailable tooltip={t('No results found')} />
        </SingleEmptySubText>
      </div>
    );

    return (
      <Fragment>
        <div>
          <PanelItem>{t('User Misery')}</PanelItem>
        </div>
        {allReleasesTableData?.data.length === 0
          ? emptyColumn
          : allReleasesTableData?.data.map((dataRow, idx) => {
              const allReleasesMisery = miseryRenderer?.(dataRow, {
                organization,
                location,
              });

              return (
                <div key={idx}>
                  <UserMiseryPanelItem>{allReleasesMisery}</UserMiseryPanelItem>
                </div>
              );
            })}
        {thisReleaseTableData?.data.length === 0
          ? emptyColumn
          : thisReleaseTableData?.data.map((dataRow, idx) => {
              const thisReleasesMisery = miseryRenderer?.(dataRow, {
                organization,
                location,
              });

              return (
                <div key={idx}>
                  <UserMiseryPanelItem>{thisReleasesMisery}</UserMiseryPanelItem>
                </div>
              );
            })}
        <div>{userMiseryTrend()}</div>
      </Fragment>
    );
  }

  const loader = <StyledLoadingIndicator />;

  const platformPerformanceRender: Partial<
    Record<ProjectPerformanceType, {section: React.ReactNode; title: string}>
  > = {
    [ProjectPerformanceType.FRONTEND]: {
      title: t('Frontend Performance'),
      section: renderFrontendPerformance(),
    },
    [ProjectPerformanceType.BACKEND]: {
      title: t('Backend Performance'),
      section: renderBackendPerformance(),
    },
    [ProjectPerformanceType.MOBILE]: {
      title: t('Mobile Performance'),
      section: renderMobilePerformance(),
    },
    [ProjectPerformanceType.ANY]: {
      title: t('[Unknown] Performance'),
      section: renderUnknownPerformance(),
    },
  };

  const isUnknownPlatform = performanceType === ProjectPerformanceType.ANY;

  return (
    <Fragment>
      <HeadCellContainer>
        {platformPerformanceRender[performanceType]?.title}
      </HeadCellContainer>
      {isUnknownPlatform && (
        <StyledAlert type="warning" showIcon system>
          {tct(
            'For more performance metrics, specify which platform this project is using in [link]',
            {
              link: (
                <Link to={`/settings/${organization.slug}/projects/${project.slug}/`}>
                  {t('project settings.')}
                </Link>
              ),
            }
          )}
        </StyledAlert>
      )}
      <StyledPanelTable
        isLoading={isLoading}
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
        disablePadding
        loader={loader}
        disableTopBorder={isUnknownPlatform}
      >
        {platformPerformanceRender[performanceType]?.section}
      </StyledPanelTable>
    </Fragment>
  );
}

interface Props {
  allReleasesEventView: EventView;
  location: Location;
  organization: Organization;
  performanceType: ProjectPerformanceType;
  project: ReleaseProject;
  releaseEventView: EventView;
}

function PerformanceCardTableWrapper({
  organization,
  project,
  allReleasesEventView,
  releaseEventView,
  performanceType,
  location,
}: Props) {
  return (
    <DiscoverQuery
      eventView={allReleasesEventView}
      orgSlug={organization.slug}
      location={location}
    >
      {({isLoading, tableData: allReleasesTableData}) => (
        <DiscoverQuery
          eventView={releaseEventView}
          orgSlug={organization.slug}
          location={location}
        >
          {({isLoading: isReleaseLoading, tableData: thisReleaseTableData}) => (
            <PerformanceCardTable
              isLoading={isLoading || isReleaseLoading}
              organization={organization}
              location={location}
              project={project}
              allReleasesEventView={allReleasesEventView}
              releaseEventView={releaseEventView}
              allReleasesTableData={allReleasesTableData}
              thisReleaseTableData={thisReleaseTableData}
              performanceType={performanceType}
            />
          )}
        </DiscoverQuery>
      )}
    </DiscoverQuery>
  );
}

export default PerformanceCardTableWrapper;

const emptyFieldCss = (p: any) => css`
  color: ${p.theme.chartOther};
  text-align: right;
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  margin: 70px auto;
`;

const HeadCellContainer = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  padding: ${space(2)};
  border-top: 1px solid ${p => p.theme.border};
  border-left: 1px solid ${p => p.theme.border};
  border-right: 1px solid ${p => p.theme.border};
  border-top-left-radius: ${p => p.theme.borderRadius};
  border-top-right-radius: ${p => p.theme.borderRadius};
`;

const StyledPanelTable = styled(PanelTable)<{disableTopBorder: boolean}>`
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  border-top: ${p => (p.disableTopBorder ? 'none' : `1px solid ${p.theme.border}`)};
  @media (max-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: min-content 1fr 1fr 1fr;
  }
`;

const StyledPanelItem = styled(PanelItem)`
  display: block;
  white-space: nowrap;
  width: 100%;
`;

const SubTitle = styled('div')`
  margin-left: ${space(3)};
`;

const TitleSpace = styled('div')`
  height: 24px;
`;

const UserMiseryPanelItem = styled(PanelItem)`
  justify-content: flex-end;
`;

const ApdexPanelItem = styled(PanelItem)`
  text-align: right;
`;

const SingleEmptySubText = styled(PanelItem)`
  display: block;
  ${emptyFieldCss}
`;

const MultipleEmptySubText = styled('div')`
  ${emptyFieldCss}
`;

const Cell = styled('div')<{align: 'left' | 'right'}>`
  text-align: ${p => p.align};
  margin-left: ${p => p.align === 'left' && space(2)};
  padding-right: ${p => p.align === 'right' && space(2)};
  ${p => p.theme.overflowEllipsis}
`;

const StyledAlert = styled(Alert)`
  border-top: 1px solid ${p => p.theme.border};
  border-right: 1px solid ${p => p.theme.border};
  border-left: 1px solid ${p => p.theme.border};
  margin-bottom: 0;
`;

const StyledNotAvailable = styled(NotAvailable)`
  text-align: right;
`;

const SubText = styled('div')`
  color: ${p => p.theme.subText};
  text-align: right;
`;

const TrendText = styled('div')<{color: 'success' | 'error'}>`
  color: ${p => p.theme[p.color]};
  text-align: right;
`;

const StyledIconArrow = styled(IconArrow)<{color: 'success' | 'error'}>`
  color: ${p => p.theme[p.color]};
  margin-left: ${space(0.5)};
`;
