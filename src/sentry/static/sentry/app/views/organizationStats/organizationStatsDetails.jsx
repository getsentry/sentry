import PropTypes from 'prop-types';
import {Component, Fragment} from 'react';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {intcomma} from 'app/utils';
import {t} from 'app/locale';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import Pagination from 'app/components/pagination';
import ProjectTable from 'app/views/organizationStats/projectTable';
import StackedBarChart from 'app/components/stackedBarChart';
import TextBlock from 'app/views/settings/components/text/textBlock';
import PageHeading from 'app/components/pageHeading';
import {
  ProjectTableLayout,
  ProjectTableDataElement,
} from 'app/views/organizationStats/projectTableLayout';
import {PageContent} from 'app/styles/organization';
import PerformanceAlert from 'app/views/organizationStats/performanceAlert';

class OrganizationStats extends Component {
  static propTypes = {
    statsLoading: PropTypes.bool,
    projectsLoading: PropTypes.bool,
    orgTotal: PropTypes.object,
    statsError: PropTypes.oneOfType([PropTypes.bool, PropTypes.object]),
    orgStats: PropTypes.array,
    projectTotals: PropTypes.array,
    projectMap: PropTypes.object,
    projectsError: PropTypes.oneOfType([PropTypes.bool, PropTypes.object]),
    pageLinks: PropTypes.string,
    organization: PropTypes.object,
  };

  renderTooltip(point, _pointIdx, chart) {
    const timeLabel = chart.getTimeLabel(point);
    const [accepted, rejected, blacklisted] = point.y;

    return (
      <div style={{width: '150px'}}>
        <div className="time-label">{timeLabel}</div>
        <div className="value-label">
          {intcomma(accepted)} accepted
          {rejected > 0 && (
            <Fragment>
              <br />
              {intcomma(rejected)} rate limited
            </Fragment>
          )}
          {blacklisted > 0 && (
            <Fragment>
              <br />
              {intcomma(blacklisted)} filtered
            </Fragment>
          )}
        </div>
      </div>
    );
  }

  renderContent() {
    const {
      statsLoading,
      orgTotal,
      statsError,
      orgStats,
      projectsLoading,
      projectTotals,
      projectMap,
      projectsError,
      pageLinks,
      organization,
    } = this.props;

    return (
      <div>
        <PageHeading withMargins>{t('Organization Stats')}</PageHeading>
        <div className="row">
          <div className="col-md-9">
            <TextBlock>
              {t(
                `The chart below reflects events the system has received
                across your entire organization. Events are broken down into
                three categories: Accepted, Rate Limited, and Filtered. Rate
                Limited events are entries that the system threw away due to quotas
                being hit, and Filtered events are events that were blocked
                due to your inbound data filter rules.`
              )}
            </TextBlock>
          </div>
          {!statsLoading && (
            <div className="col-md-3 stats-column">
              <h6 className="nav-header">{t('Events per minute')}</h6>
              <p className="count">{orgTotal.avgRate}</p>
            </div>
          )}
        </div>
        <div>
          <PerformanceAlert />
          {statsLoading ? (
            <LoadingIndicator />
          ) : statsError ? (
            <LoadingError onRetry={this.fetchData} />
          ) : (
            <Panel className="bar-chart">
              <StackedBarChart
                points={orgStats}
                height={150}
                label="events"
                className="standard-barchart b-a-0 m-b-0"
                barClasses={['accepted', 'rate-limited', 'black-listed']}
                minHeights={[2, 0, 0]}
                gap={0.25}
                tooltip={this.renderTooltip}
              />
            </Panel>
          )}
        </div>

        <Panel>
          <PanelHeader>
            <ProjectTableLayout>
              <div>{t('Project')}</div>
              <ProjectTableDataElement>{t('Accepted')}</ProjectTableDataElement>
              <ProjectTableDataElement>{t('Rate Limited')}</ProjectTableDataElement>
              <ProjectTableDataElement>{t('Filtered')}</ProjectTableDataElement>
              <ProjectTableDataElement>{t('Total')}</ProjectTableDataElement>
            </ProjectTableLayout>
          </PanelHeader>
          <PanelBody>
            {statsLoading || projectsLoading ? (
              <LoadingIndicator />
            ) : projectsError ? (
              <LoadingError onRetry={this.fetchData} />
            ) : (
              <ProjectTable
                projectTotals={projectTotals}
                orgTotal={orgTotal}
                organization={organization}
                projectMap={projectMap}
              />
            )}
          </PanelBody>
        </Panel>
        {pageLinks && <Pagination pageLinks={pageLinks} {...this.props} />}
      </div>
    );
  }

  render() {
    return (
      <Fragment>
        <PageContent>{this.renderContent()}</PageContent>
      </Fragment>
    );
  }
}

export default OrganizationStats;
