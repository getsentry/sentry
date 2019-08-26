import React from 'react';
import {Location} from 'history';
import {pick} from 'lodash';
import {browserHistory} from 'react-router';

import withApi from 'app/utils/withApi';
import {Client} from 'app/api';
import {Organization} from 'app/types';
import {DEFAULT_PER_PAGE} from 'app/constants';

import {DEFAULT_EVENT_VIEW_V1} from './data';
import {EventQuery} from './utils';
import EventView from './eventView';

type Props = {
  api: Client;
  location: Location;
  organization: Organization;
};

type State = {
  eventView: EventView;
};

class Discover2Table extends React.PureComponent<Props, State> {
  state: State = {
    eventView: EventView.fromLocation(this.props.location),
  };

  static getDerivedStateFromProps(props: Props): State {
    return {
      eventView: EventView.fromLocation(props.location),
    };
  }

  componentDidMount() {
    const {location} = this.props;

    if (!this.state.eventView.isComplete()) {
      const nextEventView = EventView.fromEventViewv1(DEFAULT_EVENT_VIEW_V1);

      browserHistory.replace({
        pathname: location.pathname,
        query: {
          ...location.query,
          ...nextEventView.generateQueryStringObject(),
        },
      });
      return;
    }

    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    if (this.props.location !== prevProps.location) {
      this.fetchData();
    }
  }

  getQuery = () => {
    const {query} = this.props.location;

    // TODO: consolidate this

    type LocationQuery = {
      project?: string;
      environment?: string;
      start?: string;
      end?: string;
      utc?: string;
      statsPeriod?: string;
      cursor?: string;
      sort?: string;
    };

    const picked = pick<LocationQuery>(query || {}, [
      'project',
      'environment',
      'start',
      'end',
      'utc',
      'statsPeriod',
      'cursor',
      'sort',
    ]);

    const fieldNames = this.state.eventView.getFieldSnubaCols();

    const defaultSort = fieldNames.length > 0 ? [fieldNames[0]] : undefined;

    const eventQuery: EventQuery = Object.assign(picked, {
      field: [...new Set(fieldNames)],
      sort: picked.sort ? picked.sort : defaultSort,
      per_page: DEFAULT_PER_PAGE,
      query: this.state.eventView.getQuery(query.query),
    });

    if (!eventQuery.sort) {
      delete eventQuery.sort;
    }

    return eventQuery;
  };

  fetchData = () => {
    const {organization} = this.props;

    const url = `/organizations/${organization.slug}/eventsv2/`;

    this.props.api.request(url, {
      query: this.getQuery(),
      success: (data, __textStatus, __jqxhr) => {
        console.log('data', data);

        // const projectMap = {};
        // data.forEach(project => {
        //   projectMap[project.id] = project;
        // });
        // this.setState(prevState => {
        //   return {
        //     pageLinks: jqxhr.getResponseHeader('Link'),
        //     projectMap,
        //     projectsRequestsPending: prevState.projectsRequestsPending - 1,
        //   };
        // });
      },
      error: err => {
        console.log('error', err);
        // this.setState({
        //   projectsError: true,
        // });
      },
    });
  };

  render() {
    return <div>foo</div>;
  }
}

export default withApi(Discover2Table);
