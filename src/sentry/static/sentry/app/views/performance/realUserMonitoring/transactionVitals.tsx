import React from 'react';
import {Location} from 'history';

import {Panel} from 'app/components/panels';
import {Organization} from 'app/types';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import EventView from 'app/utils/discover/eventView';
import {getAggregateAlias} from 'app/utils/discover/fields';
import theme from 'app/utils/theme';

import {PERCENTILE, WEB_VITAL_DETAILS} from './constants';
import {WebVital} from './types';
import VitalCard from './vitalCard';
import MeasuresHistogramQuery from './measuresHistogramQuery';

type Props = {
  organization: Organization;
  location: Location;
  eventView: EventView;
};

class TransactionVitals extends React.Component<Props> {
  generateSummaryEventView() {
    const {eventView} = this.props;

    return EventView.fromSavedQuery({
      id: '',
      name: '',
      version: 2,
      fields: Object.values(WebVital).map(vital => `percentile(${vital}, ${PERCENTILE})`),
      projects: eventView.project,
      range: eventView.statsPeriod,
      query: eventView.query,
      environment: eventView.environment,
      start: eventView.start,
      end: eventView.end,
    });
  }

  render() {
    const {location, organization, eventView} = this.props;
    const vitals = Object.values(WebVital);

    const colors = [...theme.charts.getColorPalette(vitals.length - 1)].reverse();

    // TODO remove this
    const max = 10000;
    const min = 0;

    return (
      <DiscoverQuery
        location={location}
        orgSlug={organization.slug}
        eventView={this.generateSummaryEventView()}
        limit={1}
      >
        {summaryResults => {
          return (
            <Panel>
              <MeasuresHistogramQuery
                location={location}
                organization={organization}
                eventView={eventView}
                measures={vitals}
                min={min}
                max={max}
              >
                {results => {
                  return (
                    <React.Fragment>
                      {vitals.map((vital, index) => {
                        const error =
                          summaryResults.error !== null || results.errors.length > 0;
                        const alias = getAggregateAlias(
                          `percentile(${vital}, ${PERCENTILE})`
                        );
                        const summary =
                          summaryResults.tableData?.data?.[0]?.[alias] ?? null;
                        return (
                          <VitalCard
                            key={vital}
                            isLoading={summaryResults.isLoading || results.isLoading}
                            error={error}
                            vital={WEB_VITAL_DETAILS[vital]}
                            summary={summary as number | null}
                            chartData={results.histogram[vital]!}
                            colors={[colors[index]]}
                          />
                        );
                      })}
                    </React.Fragment>
                  );
                }}
              </MeasuresHistogramQuery>
              {this.renderVitals(
                Object.values(WebVital),
                summaryResults,
                colors.slice(0, colors.length)
              )}
            </Panel>
          );
        }}
      </DiscoverQuery>
    );
  }
}

export default TransactionVitals;
