import {Fragment} from 'react';
import * as React from 'react';
import {Link} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import Alert from 'app/components/alert';
import AsyncComponent from 'app/components/asyncComponent';
import {DateTimeObject} from 'app/components/charts/utils';
import LoadingIndicator from 'app/components/loadingIndicator';
import {PanelItem} from 'app/components/panels';
import PanelTable from 'app/components/panels/panelTable';
import {IconArrow, IconWarning} from 'app/icons';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Organization, ReleaseProject} from 'app/types';
import DiscoverQuery, {TableData} from 'app/utils/discover/discoverQuery';
import EventView from 'app/utils/discover/eventView';
import {getFieldRenderer} from 'app/utils/discover/fieldRenderers';
import {MobileVital, WebVital} from 'app/utils/discover/fields';
import {
  MOBILE_VITAL_DETAILS,
  WEB_VITAL_DETAILS,
} from 'app/utils/performance/vitals/constants';
import type {Color} from 'app/utils/theme';

type PerformanceCardTableProps = {
  organization: Organization;
  location: Location;
  project: ReleaseProject;
  allReleaseEventView: EventView;
  releaseEventView: EventView;
  allReleaseTableData: TableData | null;
  releaseTableData: TableData | null;
  platformPerformance: string;
  isLoading: boolean;
};

function PerformanceCardTable({
  organization,
  location,
  project,
  releaseEventView,
  allReleaseTableData,
  releaseTableData,
  platformPerformance,
  isLoading,
}: PerformanceCardTableProps) {
  const discoverPath = `/organizations/${organization.slug}/discover/results/`;

  const miseryRenderer =
    allReleaseTableData?.meta &&
    getFieldRenderer('user_misery_300', allReleaseTableData.meta);

  function renderChange(allReleaseScore: number, thisReleaseScore: number, meta: string) {
    if (thisReleaseScore === undefined) {
      return <SubText>{'\u2014'}</SubText>;
    }

    const trend = allReleaseScore - thisReleaseScore;
    const trendPercentage = (allReleaseScore - thisReleaseScore) * 100;
    const valPercentage = Math.round(Math.abs(trendPercentage));
    const val = trend.toFixed(2);

    if (trend === 0) {
      return <SubText>{`0${meta === 'duration' ? 'ms' : '%'}`}</SubText>;
    }

    return (
      <TrendText color={trend >= 0 ? 'green300' : 'red300'}>
        {`${meta === 'duration' ? val : valPercentage}${
          meta === 'duration' ? 'ms' : '%'
        }`}
        <IconArrow
          color={trend >= 0 ? 'green300' : 'red300'}
          direction={trend >= 0 ? 'down' : 'up'}
          size="xs"
        />
      </TrendText>
    );
  }

  function userMiseryTrend() {
    return (
      <StyledPanelItem>
        {renderChange(
          allReleaseTableData?.data[0].user_misery_300 as number,
          releaseTableData?.data[0].user_misery_300 as number,
          allReleaseTableData?.meta?.user_misery_300 as string
        )}
      </StyledPanelItem>
    );
  }

  function renderFrontendPerformance() {
    const webVitals = [
      {title: WebVital.FCP, field: 'p75_measurements_fcp'},
      {title: WebVital.FID, field: 'p75_measurements_fid'},
      {title: WebVital.LCP, field: 'p75_measurements_lcp'},
      {title: WebVital.CLS, field: 'p75_measurements_cls'},
    ];
    const webVitalTitles = webVitals.map((vital, idx) => {
      return (
        <SubTitle key={idx}>
          <Link
            to={{
              pathname: discoverPath,
              query: {
                query: `event.type:transaction ${releaseEventView.query}`,
                project: `${releaseEventView.project}`,
                field: `p75(${vital.title})`,
                statsPeriod: `${releaseEventView.statsPeriod}`,
              },
            }}
          >
            {WEB_VITAL_DETAILS[vital.title].name} (
            {WEB_VITAL_DETAILS[vital.title].acronym})
          </Link>
        </SubTitle>
      );
    });

    const webVitalsRenderer = webVitals.map(
      vital =>
        allReleaseTableData?.meta &&
        getFieldRenderer(vital.field, allReleaseTableData?.meta)
    );

    const spans = [
      {title: 'HTTP', field: 'spans.http'},
      {title: 'DB', field: 'spans.db'},
      {title: 'Browser', field: 'spans.browser'},
      {title: 'Resource', field: 'spans.resource'},
    ];

    const spanTitles = spans.map((span, idx) => {
      return (
        <SubTitle key={idx}>
          <Link
            to={{
              pathname: discoverPath,
              query: {
                query: `event.type:transaction ${releaseEventView.query}`,
                project: `${releaseEventView.project}`,
                field: `${span.field}`,
                statsPeriod: `${releaseEventView.statsPeriod}`,
              },
            }}
          >
            {t(span.title)}
          </Link>
        </SubTitle>
      );
    });

    const spansRenderer = spans.map(
      span =>
        allReleaseTableData?.meta &&
        getFieldRenderer(span.field, allReleaseTableData?.meta)
    );

    const webReleaseTrend = webVitals.map(vital => {
      return {
        allReleasesRow: {
          data: allReleaseTableData?.data[0][vital.field],
          meta: allReleaseTableData?.meta?.[vital.field],
        },
        thisReleaseRow: {
          data: releaseTableData?.data[0][vital.field],
          meta: releaseTableData?.meta?.[vital.field],
        },
      };
    });
    const spansReleaseTrend = spans.map(span => {
      return {
        allReleasesRow: {
          data: allReleaseTableData?.data[0][span.field],
          meta: allReleaseTableData?.meta?.[span.field],
        },
        thisReleaseRow: {
          data: releaseTableData?.data[0][span.field],
          meta: releaseTableData?.meta?.[span.field],
        },
      };
    });

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
        {allReleaseTableData?.data.map((dataRow, idx) => {
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
        {releaseTableData?.data.map((dataRow, idx) => {
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
                row.allReleasesRow.data as number,
                row.thisReleaseRow?.data as number,
                row.allReleasesRow.meta as string
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
      {title: 'HTTP', field: 'spans.http'},
      {title: 'DB', field: 'spans.db'},
    ];

    const spanTitles = spans.map((span, idx) => {
      return (
        <SubTitle key={idx}>
          <Link
            to={{
              pathname: discoverPath,
              query: {
                query: `event.type:transaction ${releaseEventView.query}`,
                project: `${releaseEventView.project}`,
                field: `${span.field}`,
                statsPeriod: `${releaseEventView.statsPeriod}`,
              },
            }}
          >
            {t(span.title)}
          </Link>
        </SubTitle>
      );
    });

    const apdexRenderer =
      allReleaseTableData?.meta &&
      getFieldRenderer('apdex_300', allReleaseTableData.meta);

    const spansRenderer = spans.map(
      span =>
        allReleaseTableData?.meta &&
        getFieldRenderer(span.field, allReleaseTableData?.meta)
    );

    const spansReleaseTrend = spans.map(span => {
      return {
        allReleasesRow: {
          data: allReleaseTableData?.data[0][span.field],
          meta: allReleaseTableData?.meta?.[span.field],
        },
        thisReleaseRow: {
          data: releaseTableData?.data[0][span.field],
          meta: releaseTableData?.meta?.[span.field],
        },
      };
    });

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
        {allReleaseTableData?.data.map((dataRow, idx) => {
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
              {!dataRow.apdex_300 ? (
                <ApdexSubText>{'n/a'}</ApdexSubText>
              ) : (
                <ApdexPanelItem>{allReleasesApdex}</ApdexPanelItem>
              )}
              <StyledPanelItem>
                <TitleSpace />
                {allReleasesSpans.map(span => span)}
              </StyledPanelItem>
            </div>
          );
        })}
        {releaseTableData?.data.map((dataRow, idx) => {
          const thisReleasesMisery = miseryRenderer?.(dataRow, {
            organization,
            location,
          });
          const thisReleasesApdex = apdexRenderer?.(dataRow, {organization, location});

          const thisReleasesSpans = spansRenderer?.map(renderer =>
            renderer?.(dataRow, {organization, location})
          );

          return (
            <div key={idx}>
              <UserMiseryPanelItem>{thisReleasesMisery}</UserMiseryPanelItem>
              {!dataRow.apdex_300 ? (
                <ApdexSubText>{'n/a'}</ApdexSubText>
              ) : (
                <ApdexPanelItem>{thisReleasesApdex}</ApdexPanelItem>
              )}
              <StyledPanelItem>
                <TitleSpace />
                {thisReleasesSpans.map(span => span)}
              </StyledPanelItem>
            </div>
          );
        })}
        <div>
          {userMiseryTrend()}
          <StyledPanelItem>
            {renderChange(
              allReleaseTableData?.data[0].apdex_300 as number,
              releaseTableData?.data[0].apdex_300 as number,
              allReleaseTableData?.meta?.apdex_300 as string
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

  function renderMobilePerformance() {
    const mobileVitals = [
      MobileVital.AppStartCold,
      MobileVital.AppStartWarm,
      MobileVital.FramesSlow,
      MobileVital.FramesFrozen,
    ];
    const mobileVitalTitles = mobileVitals.map(mobileVital => {
      return (
        <PanelItem key={mobileVital}>{MOBILE_VITAL_DETAILS[mobileVital].name}</PanelItem>
      );
    });

    const mobileVitalFields = [
      'p75_measurements_app_start_cold',
      'p75_measurements_app_start_warm',
      'p75_measurements_frames_slow',
      'p75_measurements_frames_frozen',
    ];
    const mobileVitalsRenderer = mobileVitalFields.map(
      field =>
        allReleaseTableData?.meta && getFieldRenderer(field, allReleaseTableData?.meta)
    );

    const mobileReleaseTrend = mobileVitalFields.map(field => {
      return {
        allReleasesRow: {
          data: allReleaseTableData?.data[0][field],
          meta: allReleaseTableData?.meta?.[field],
        },
        thisReleaseRow: {
          data: releaseTableData?.data[0][field],
          meta: releaseTableData?.meta?.[field],
        },
      };
    });

    return (
      <Fragment>
        <div>
          <PanelItem>{t('User Misery')}</PanelItem>
          {mobileVitalTitles}
        </div>
        {allReleaseTableData?.data.map((dataRow, idx) => {
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
        {releaseTableData?.data.map((dataRow, idx) => {
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
    return (
      <Fragment>
        <div>
          <PanelItem>{t('User Misery')}</PanelItem>
        </div>
        {allReleaseTableData?.data.map((dataRow, idx) => {
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
        {releaseTableData?.data.map((dataRow, idx) => {
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

  const loader = <LoadingIndicator style={{margin: '70px auto'}} />;

  const title = platformPerformance.includes(t('frontend'))
    ? t('Frontend Performance')
    : platformPerformance.includes(t('backend'))
    ? t('Backend Performance')
    : platformPerformance.includes(t('mobile'))
    ? t('Mobile Performance')
    : t('[Unknown] Performance');

  const platformPerformanceRender = platformPerformance.includes(t('frontend'))
    ? renderFrontendPerformance()
    : platformPerformance.includes(t('backend'))
    ? renderBackendPerformance()
    : platformPerformance.includes(t('mobile'))
    ? renderMobilePerformance()
    : renderUnknownPerformance();

  return (
    <Fragment>
      <HeadCellContainer>{title}</HeadCellContainer>
      {platformPerformance.includes(t('unknown')) ? (
        <StyledAlert type="warning" icon={<IconWarning size="md" />} system>
          For more performance metrics, specify which platform this project is using in{' '}
          <Link to={`/settings/${organization.slug}/projects/${project.slug}/`}>
            project settings.
          </Link>
        </StyledAlert>
      ) : null}
      <StyledPanelTable
        isLoading={isLoading}
        isEmpty={false}
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
        disablePadding
        loader={loader}
        disableTopBorder={platformPerformance.includes(t('unknown'))}
      >
        {platformPerformanceRender}
      </StyledPanelTable>
    </Fragment>
  );
}

type Props = AsyncComponent['props'] & {
  organization: Organization;
  allReleaseEventView: EventView;
  releaseEventView: EventView;
  platformPerformance: string;
  project: ReleaseProject;
  location: Location;
  period?: string;
  start?: string;
  end?: string;
} & DateTimeObject;

function PerformanceCardTableWrapper({
  organization,
  project,
  allReleaseEventView,
  releaseEventView,
  platformPerformance,
  location,
}: Props) {
  return (
    <DiscoverQuery
      eventView={allReleaseEventView}
      orgSlug={organization.slug}
      location={location}
    >
      {({isLoading, tableData: allReleaseTableData}) => (
        <DiscoverQuery
          eventView={releaseEventView}
          orgSlug={organization.slug}
          location={location}
        >
          {({isLoading: isReleaseLoading, tableData: releaseTableData}) => (
            <PerformanceCardTable
              isLoading={isLoading || isReleaseLoading}
              organization={organization}
              location={location}
              project={project}
              allReleaseEventView={allReleaseEventView}
              releaseEventView={releaseEventView}
              allReleaseTableData={allReleaseTableData}
              releaseTableData={releaseTableData}
              platformPerformance={platformPerformance}
            />
          )}
        </DiscoverQuery>
      )}
    </DiscoverQuery>
  );
}

export default PerformanceCardTableWrapper;

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
  @media (max-width: ${p => p.theme.breakpoints[2]}) {
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

const ApdexSubText = styled(PanelItem)`
  display: block;
  color: ${p => p.theme.gray300};
  text-align: right;
`;

const Cell = styled('div')<{align: 'left' | 'right'}>`
  text-align: ${p => p.align};
  margin-left: ${p => p.align === 'left' && space(2)};
  padding-right: ${p => p.align === 'right' && space(2)};
  ${overflowEllipsis}
`;

const StyledAlert = styled(Alert)`
  border-top: 1px solid ${p => p.theme.border};
  border-right: 1px solid ${p => p.theme.border};
  border-left: 1px solid ${p => p.theme.border};
  margin-bottom: 0;
`;

const SubText = styled('div')`
  color: ${p => p.theme.subText};
  text-align: right;
`;

const TrendText = styled('div')<{color: Color}>`
  color: ${p => p.theme[p.color]};
  text-align: right;
`;
