import React from 'react';
import PropTypes from 'prop-types';

import LoadingError from '../../../../components/loadingError';
import LoadingIndicator from '../../../../components/loadingIndicator';
import StackedBarChart from '../../../../components/stackedBarChart';
import Pagination from '../../../../components/pagination';
import SettingsPageHeader from '../../components/settingsPageHeader';

import ProjectTable from './projectTable';
import {t} from '../../../../locale';
import {intcomma} from '../../../../utils';

class OrganizationStats extends React.Component {
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

  renderTooltip(point, pointIdx, chart) {
    let timeLabel = chart.getTimeLabel(point);
    let [accepted, rejected, blacklisted] = point.y;

    let value = `${intcomma(accepted)} accepted`;
    if (rejected) {
      value += `<br>${intcomma(rejected)} rate limited`;
    }
    if (blacklisted) {
      value += `<br>${intcomma(blacklisted)} filtered`;
    }

    return (
      '<div style="width:150px">' +
      `<div class="time-label">${timeLabel}</div>` +
      `<div class="value-label">${value}</div>` +
      '</div>'
    );
  }

  render() {
    let {
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
        <SettingsPageHeader label={t('Organization Stats')} />
        <div className="row">
          <div className="col-md-9">
            <p>
              {t(
                `The chart below reflects events the system has received
            across your entire organization. Events are broken down into
            three categories: Accepted, Rate Limited, and Filtered. Rate
            Limited events are entries that the system threw away due to quotas
            being hit, and Filtered events are events that were blocked
            due to your inbound data filter rules.`
              )}
            </p>
          </div>
          {!statsLoading && (
            <div className="col-md-3 stats-column">
              <h6 className="nav-header">{t('Events per minute')}</h6>
              <p className="count">{orgTotal.avgRate}</p>
            </div>
          )}
        </div>
        <div className="organization-stats">
          {statsLoading ? (
            <LoadingIndicator />
          ) : statsError ? (
            <LoadingError onRetry={this.fetchData} />
          ) : (
            <div className="bar-chart">
              <StackedBarChart
                points={orgStats}
                height={150}
                label="events"
                className="standard-barchart"
                barClasses={['accepted', 'rate-limited', 'black-listed']}
                tooltip={this.renderTooltip}
              />
            </div>
          )}
        </div>

        <div className="box">
          <div className="box-header">
            <h3>{t('Events by Project')}</h3>
          </div>
          <div className="box-content">
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
          </div>
        </div>
        {pageLinks && <Pagination pageLinks={pageLinks} {...this.props} />}
      </div>
    );
  }
}

export default OrganizationStats;
