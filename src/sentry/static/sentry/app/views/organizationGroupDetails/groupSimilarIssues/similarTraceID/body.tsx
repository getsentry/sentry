import {Location} from 'history';
import moment from 'moment-timezone';

import LoadingIndicator from 'app/components/loadingIndicator';
import {getTraceDateTimeRange} from 'app/components/events/interfaces/spans/utils';
import EventView from 'app/utils/discover/eventView';
import {t} from 'app/locale';
import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';
import {Organization, Event} from 'app/types';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import {Panel, PanelBody} from 'app/components/panels';
import EmptyStateWarning from 'app/components/emptyStateWarning';

import List from './list';

type Props = {
  event: Event;
  organization: Organization;
  location: Location;
  traceID?: string;
};

const Body = ({traceID, organization, event, location}: Props) => {
  if (!traceID) {
    return (
      <Panel>
        <PanelBody>
          <EmptyStateWarning small withIcon={false}>
            {t(
              'This event has no trace context, therefore it was not possible to fetch similar issues by trace ID.'
            )}
          </EmptyStateWarning>
        </PanelBody>
      </Panel>
    );
  }

  const orgSlug = organization.slug;
  const orgFeatures = organization.features;
  const dateCreated = moment(event.dateCreated).valueOf() / 1000;
  const {start, end} = getTraceDateTimeRange({start: dateCreated, end: dateCreated});

  const eventView = EventView.fromSavedQuery({
    id: undefined,
    name: `Issues with Trace ID ${traceID}`,
    fields: ['issue.id'],
    orderby: '-timestamp',
    query: `trace:${traceID} !event.type:transaction !id:${event.id} `,
    projects: orgFeatures.includes('global-views')
      ? [ALL_ACCESS_PROJECTS]
      : [Number(event.projectID)],
    version: 2,
    start,
    end,
  });

  return (
    <DiscoverQuery eventView={eventView} location={location} orgSlug={orgSlug} limit={5}>
      {data => {
        if (data.isLoading) {
          return <LoadingIndicator />;
        }

        const issues = data?.tableData?.data || [];

        return (
          <List
            issues={issues}
            pageLinks={data.pageLinks}
            traceID={traceID}
            orgSlug={orgSlug}
            location={location}
            period={{start, end}}
          />
        );
      }}
    </DiscoverQuery>
  );
};

export default Body;
