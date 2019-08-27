import React from 'react';
import {Location} from 'history';
import {pick, omit} from 'lodash';
import {browserHistory} from 'react-router';
import styled from 'react-emotion';

import space from 'app/styles/space';
import withApi from 'app/utils/withApi';
import {Client} from 'app/api';
import {Organization} from 'app/types';
import {DEFAULT_PER_PAGE} from 'app/constants';
import Pagination from 'app/components/pagination';
import Panel from 'app/components/panels/panel';
import {PanelBody} from 'app/components/panels';
// import { PanelHeader, PanelItem} from 'app/components/panels';
import LoadingContainer from 'app/components/loading/loadingContainer';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import {t} from 'app/locale';

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
  loading: boolean;
  hasError: boolean;

  pageLinks: null | string;

  // TODO(ts): type this

  data: any[] | null;
};

class Discover2Table extends React.PureComponent<Props, State> {
  state: State = {
    eventView: EventView.fromLocation(this.props.location),
    loading: true,
    hasError: false,
    pageLinks: null,
    data: null,
  };

  static getDerivedStateFromProps(props: Props, state: State): State {
    return {
      ...state,
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
      success: (data, __textStatus, jqxhr) => {
        // TODO: remove
        console.log('data', data);

        this.setState(prevState => {
          return {
            loading: false,
            hasError: false,
            pageLinks: jqxhr ? jqxhr.getResponseHeader('Link') : prevState.pageLinks,
            data,
          };
        });
      },
      error: _err => {
        this.setState({
          hasError: true,
        });
      },
    });
  };

  render() {
    const {organization, location} = this.props;
    const {pageLinks, eventView, loading, data} = this.state;

    return (
      <div>
        <Table
          eventView={eventView}
          organization={organization}
          data={data || []}
          isLoading={loading}
          location={location}
        />
        <Pagination pageLinks={pageLinks} />
      </div>
    );
  }
}

type TableProps = {
  organization: Organization;
  eventView: EventView;
  isLoading: boolean;
  data: any[];
  location: Location;
};

class Table extends React.Component<TableProps> {
  renderLoading = () => {
    return (
      <Panel>
        <PanelBody style={{minHeight: '240px'}}>
          <LoadingContainer isLoading={true} />
        </PanelBody>
      </Panel>
    );
  };

  renderTitle = () => {
    return this.props.eventView.getFieldTitles().map((title, index) => {
      return <PanelHeaderCell key={index}>{title}</PanelHeaderCell>;
    });
  };

  renderContent = () => {
    const {data, eventView} = this.props;

    if (data.length === 0) {
      return (
        <EmptyStateWarning>
          <p>{t('No results found')}</p>
        </EmptyStateWarning>
      );
    }

    return (
      <PanelGridInfo numOfCols={eventView.numOfColumns()}>
        <EmptyStateWarning>
          <p>{t('No results found')}</p>
        </EmptyStateWarning>
      </PanelGridInfo>
    );
  };

  renderTable = () => {
    return (
      <React.Fragment>
        {this.renderTitle()}
        {this.renderContent()}
      </React.Fragment>
    );
  };

  render() {
    const {isLoading, eventView} = this.props;

    if (isLoading) {
      return this.renderLoading();
    }

    return (
      <PanelGrid numOfCols={eventView.numOfColumns()}>{this.renderTable()}</PanelGrid>
    );
  }
}

type PanelGridProps = {
  numOfCols: number;
};

const PanelGrid = styled((props: PanelGridProps) => {
  const otherProps = omit(props, 'numOfCols');
  return <Panel {...otherProps} />;
})<PanelGridProps>`
  display: grid;

  ${(props: PanelGridProps) => {
    // TODO: change this
    return `
      grid-template-columns: repeat(${props.numOfCols}, minmax(auto, max-content));
    `;
  }};
`;

const PanelHeaderCell = styled('div')`
  color: ${p => p.theme.gray3};
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  border-bottom: 1px solid ${p => p.theme.borderDark};
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  background: ${p => p.theme.offWhite};
  line-height: 1;
  position: relative;

  padding: ${space(2)};
`;

type PanelGridInfoProps = {
  numOfCols: number;
};

const PanelGridInfo = styled('div')<PanelGridInfoProps>`
  ${(props: PanelGridInfoProps) => {
    return `
  grid-column: 1 / span ${props.numOfCols};
  `;
  }};
`;

export default withApi<Props>(Discover2Table);
