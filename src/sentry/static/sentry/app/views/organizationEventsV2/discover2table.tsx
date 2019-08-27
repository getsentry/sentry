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
import LoadingContainer from 'app/components/loading/loadingContainer';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import {t} from 'app/locale';

import {DEFAULT_EVENT_VIEW_V1} from './data';
import {EventQuery, MetaType, getFieldRenderer} from './utils';
import EventView from './eventView';

type DataRow = {
  [key: string]: string;
};

// TODO: move this
type DataPayload = {
  data: Array<DataRow>;
  meta: MetaType;
};

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
  dataPayload: DataPayload | null | undefined;
};

class Discover2Table extends React.PureComponent<Props, State> {
  state: State = {
    eventView: EventView.fromLocation(this.props.location),
    loading: true,
    hasError: false,
    pageLinks: null,
    dataPayload: null,
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
      success: (dataPayload, __textStatus, jqxhr) => {
        this.setState(prevState => {
          return {
            loading: false,
            hasError: false,
            pageLinks: jqxhr ? jqxhr.getResponseHeader('Link') : prevState.pageLinks,
            dataPayload,
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
    const {pageLinks, eventView, loading, dataPayload} = this.state;

    return (
      <Container>
        <Table
          eventView={eventView}
          organization={organization}
          dataPayload={dataPayload}
          isLoading={loading}
          location={location}
        />
        <Pagination pageLinks={pageLinks} />
      </Container>
    );
  }
}

type TableProps = {
  organization: Organization;
  eventView: EventView;
  isLoading: boolean;
  dataPayload: DataPayload | null | undefined;
  location: Location;
};

type TableState = {
  expandColumn: null | number;
};

class Table extends React.Component<TableProps, TableState> {
  state: TableState = {
    expandColumn: null,
  };

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

  renderContent = (): React.ReactNode => {
    const {dataPayload, eventView, organization, location} = this.props;

    if (!(dataPayload && dataPayload.data && dataPayload.data.length > 0)) {
      return (
        <PanelGridInfo numOfCols={eventView.numOfColumns()}>
          <EmptyStateWarning>
            <p>{t('No results found')}</p>
          </EmptyStateWarning>
        </PanelGridInfo>
      );
    }

    const {meta} = dataPayload;
    const fields = eventView.getFieldSnubaCols();

    // TODO: deal with this
    // if (fields.length <= 0) {
    //   return (
    //     <PanelGridInfo numOfCols={1}>
    //       <EmptyStateWarning>
    //         <p>{t('No field column selected')}</p>
    //       </EmptyStateWarning>
    //     </PanelGridInfo>
    //   );
    // }

    const lastRowIndex = dataPayload.data.length - 1;

    const firstCellIndex = 0;
    const lastCellIndex = fields.length - 1;

    return dataPayload.data.map((row, rowIndex) => {
      return (
        <React.Fragment key={rowIndex}>
          {fields.map((field, columnIndex) => {
            const key = `${field}.${columnIndex}`;

            const fieldRenderer = getFieldRenderer(field, meta);
            return (
              <PanelItemCell
                hideBottomBorder={rowIndex === lastRowIndex}
                style={{
                  paddingLeft: columnIndex === firstCellIndex ? space(1) : void 0,
                  paddingRight: columnIndex === lastCellIndex ? space(1) : void 0,
                }}
                key={key}
                onMouseEnter={() => {
                  this.setState({
                    expandColumn: columnIndex,
                  });
                }}
                onMouseLeave={() => {
                  this.setState({
                    expandColumn: null,
                  });
                }}
                onMouseOver={() => {
                  this.setState({
                    expandColumn: columnIndex,
                  });
                }}
              >
                {fieldRenderer(row, {organization, location})}
              </PanelItemCell>
            );
          })}
        </React.Fragment>
      );
    });
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
      <PanelGrid
        expandColumn={this.state.expandColumn}
        numOfCols={eventView.numOfColumns()}
      >
        {this.renderTable()}
      </PanelGrid>
    );
  }
}

type PanelGridProps = {
  numOfCols: number;
  expandColumn: number | null;
};

const PanelGrid = styled((props: PanelGridProps) => {
  const otherProps = omit(props, 'numOfCols', 'expandColumn');
  return <Panel {...otherProps} />;
})<PanelGridProps>`
  display: grid;

  ${(props: PanelGridProps) => {
    const {expandColumn} = props;

    const firstColumn = expandColumn === 0 ? 'minmax(min-content, 3fr)' : '3fr';

    function generateRestColumns(): string {
      if (props.numOfCols <= 1) {
        return '';
      }

      if (expandColumn === null || expandColumn === 0) {
        return `repeat(${props.numOfCols - 1}, auto)`;
      }

      let restColumns: string = '';
      for (let index = 1; index <= props.numOfCols - 1; index++) {
        if (expandColumn === index) {
          restColumns += ' min-content';
          continue;
        }

        restColumns += ' auto';
      }

      return restColumns;
    }

    return `
      grid-template-columns:  ${firstColumn} ${generateRestColumns()};
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

  text-overflow: ellipsis;
  overflow: hidden;

  padding: ${space(2)};

  /*
    By default, a grid item cannot be smaller than the size of its content.
    We override this by setting it to be 0.
  */
  min-width: 0;
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

const PanelItemCell = styled('div')<{hideBottomBorder: boolean}>`
  ${props => {
    if (props.hideBottomBorder) {
      return null;
    }

    return `border-bottom: 1px solid ${p => p.theme.borderLight};`;
  }};

  font-size: ${p => p.theme.fontSizeMedium};

  padding-top: ${space(1)};
  padding-bottom: ${space(1)};

  /*
    By default, a grid item cannot be smaller than the size of its content.
    We override this by setting it to be 0.
  */
  min-width: 0;
`;

const Container = styled('div')`
  min-width: 0;
  overflow: hidden;
`;

export default withApi<Props>(Discover2Table);
