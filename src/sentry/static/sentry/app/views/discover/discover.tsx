import {browserHistory} from 'react-router';
import { Component, Fragment } from 'react';
import moment from 'moment';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {getUtcDateString} from 'app/utils/dates';
import {t, tct} from 'app/locale';
import {updateProjects, updateDateTime} from 'app/actionCreators/globalSelection';
import ConfigStore from 'app/stores/configStore';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import PageHeading from 'app/components/pageHeading';
import {Organization} from 'app/types';
import localStorage from 'app/utils/localStorage';

import {
  DiscoverContainer,
  DiscoverGlobalSelectionHeader,
  Body,
  BodyContent,
  HeadingContainer,
  Sidebar,
  SidebarTabs,
  SavedQueryWrapper,
} from './styles';
import {
  getQueryStringFromQuery,
  getQueryFromQueryString,
  deleteSavedQuery,
  updateSavedQuery,
  queryHasChanged,
} from './utils';
import {isValidAggregation} from './aggregations/utils';
import {isValidCondition} from './conditions/utils';
import {trackQuery} from './analytics';
import EditSavedQuery from './sidebar/editSavedQuery';
import Intro from './intro';
import NewQuery from './sidebar/newQuery';
import QueryPanel from './sidebar/queryPanel';
import Result from './result';
import ResultLoading from './result/loading';
import SavedQueryList from './sidebar/savedQueryList';
import createResultManager from './resultManager';
import {SavedQuery} from './types';

type DefaultProps = {
  utc: boolean | null;
};

type Props = DefaultProps & {
  organization: Organization;
  location: any;
  params: any;
  queryBuilder: any;
  // savedQuery is not null if it's a saved query
  savedQuery: SavedQuery | null;
  isEditingSavedQuery: boolean;
  updateSavedQueryData: (q: SavedQuery) => void;
  view: string;
  toggleEditMode: () => void;
  isLoading: boolean;
};

type State = {
  resultManager: any;
  data: any;
  isFetchingQuery: boolean;
  isEditingSavedQuery: boolean;
  savedQueryName: string | null;
  view: string;
};

export default class Discover extends Component<Props, State> {
  static defaultProps: DefaultProps = {
    utc: true,
  };

  constructor(props: Props) {
    super(props);
    const resultManager = createResultManager(props.queryBuilder);
    this.state = {
      resultManager,
      data: resultManager.getAll(),
      isFetchingQuery: false,
      isEditingSavedQuery: props.isEditingSavedQuery,
      savedQueryName: null,
      view: props.view || 'query',
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    const {
      queryBuilder,
      location: {search},
      savedQuery,
      isEditingSavedQuery,
      params,
      isLoading,
    } = nextProps;
    const {resultManager} = this.state;

    // Run query on isLoading change if there is a querystring or saved search
    const loadingStatusChanged = isLoading !== this.props.isLoading;
    if (loadingStatusChanged && (savedQuery || !!search)) {
      this.runQuery();
      return;
    }

    if (savedQuery && savedQuery !== this.props.savedQuery) {
      this.setState({view: 'saved'});
      this.runQuery();
    }

    if (isEditingSavedQuery !== this.props.isEditingSavedQuery) {
      this.setState({isEditingSavedQuery});
      return;
    }

    if (!queryHasChanged(this.props.location.search, nextProps.location.search)) {
      return;
    }

    const newQuery = getQueryFromQueryString(search);
    // Clear data only if location.search is empty (reset has been called)
    if (!search && !params.savedQueryId) {
      queryBuilder.reset(newQuery);
      resultManager.reset();
      this.setState({
        data: resultManager.getAll(),
      });
    } else if (search) {
      // This indicates navigation changes (e.g. back button on browser)
      // We need to update our search store and probably runQuery
      const {projects, range, start, end, utc} = newQuery;

      if (projects) {
        this.updateProjects(projects);
      }

      this.updateDateTime({
        period: range || null,
        start: start || null,
        end: end || null,
        utc: typeof utc !== 'undefined' ? utc : null,
      });

      // These props come from URL string, so will always be in UTC
      updateDateTime({
        start: (start && new Date(moment.utc(start).local() as any)) || null,
        end: (end && new Date(moment.utc(end).local() as any)) || null,
        period: range || null,
        utc: typeof utc !== 'undefined' ? utc : null,
      });

      this.runQuery();
    }
  }

  updateProjects = (val: number[]): void => {
    this.updateField('projects', val);
    updateProjects(val);
  };

  getDateTimeFields = ({
    period,
    start,
    end,
    utc,
  }: {
    period: string;
    start: string;
    end: string;
    utc: boolean;
  }) => ({
    range: period || null,
    utc: typeof utc !== 'undefined' ? utc : null,
    start: (start && getUtcDateString(start)) || null,
    end: (end && getUtcDateString(end)) || null,
  });

  changeTime = (datetime: any) => {
    this.updateFields(this.getDateTimeFields(datetime));
  };

  updateDateTime = (datetime: any) => {
    const {start, end, range, utc} = this.getDateTimeFields(datetime);

    updateDateTime({
      start,
      end,
      period: range,
      utc,
    });
    this.updateFields({start, end, range, utc});
  };

  // Called when global selection header changes dates
  updateDateTimeAndRun = (datetime: any) => {
    this.updateDateTime(datetime);
    this.runQuery();
  };

  updateField = (field: string, value: any) => {
    this.props.queryBuilder.updateField(field, value);
    this.forceUpdate();
  };

  updateFields = (query: any) => {
    Object.entries(query).forEach(([field, value]) => {
      this.updateField(field, value);
    });
  };

  updateAndRunQuery = (query: any) => {
    this.updateFields(query);
    this.runQuery();
  };

  runQuery = () => {
    const {queryBuilder, organization, location} = this.props;
    const {resultManager} = this.state;

    // Track query for analytics
    trackQuery(organization, queryBuilder.getExternal());

    // Strip any invalid conditions and aggregations
    const {conditions, aggregations} = queryBuilder.getInternal();
    const filteredConditions = conditions.filter((condition: [any, any, any]) =>
      isValidCondition(condition, queryBuilder.getColumns())
    );

    const filteredAggregations = aggregations.filter((aggregation: [any, any, any]) =>
      isValidAggregation(aggregation, queryBuilder.getColumns())
    );

    if (filteredConditions.length !== conditions.length) {
      this.updateField('conditions', filteredConditions);
    }

    if (filteredAggregations.length !== aggregations.length) {
      this.updateField('aggregations', filteredAggregations);
    }

    this.setState({isFetchingQuery: true});

    resultManager
      .fetchAll()
      .then((data: any) => {
        const shouldRedirect = !this.props.params.savedQueryId;

        if (shouldRedirect) {
          browserHistory.push({
            pathname: `/organizations/${organization.slug}/discover/`,
            // This is kind of a hack, but this causes a re-render in result where this.props === nextProps after
            // a query has completed... we don't preserve `state` when we update browser history, so
            // if this is present in `Result.shouldComponentUpdate` then should perform a render
            state: 'fetching',
            // Don't drop "visualization" from querystring
            search: getQueryStringFromQuery(queryBuilder.getInternal(), {
              ...(location.query.visualization && {
                visualization: location.query.visualization,
              }),
            }),
          });
        }

        this.setState({
          data,
          isFetchingQuery: false,
        });
      })
      .catch((err: any) => {
        const message = (err && err.message) || t('An error occurred');
        addErrorMessage(message);
        this.setState({isFetchingQuery: false});
      });
  };

  onFetchPage = (nextOrPrev: string) => {
    this.setState({isFetchingQuery: true});
    return this.state.resultManager
      .fetchPage(nextOrPrev)
      .then((data: any) => {
        this.setState({data, isFetchingQuery: false});
      })
      .catch((err: any) => {
        const message = (err && err.message) || t('An error occurred');
        addErrorMessage(message);
        this.setState({isFetchingQuery: false});
      });
  };

  toggleSidebar = (view: string) => {
    if (view !== this.state.view) {
      this.setState({view});
      browserHistory.replace({
        pathname: `/organizations/${this.props.organization.slug}/discover/`,
        query: {...this.props.location.query, view},
      });
    }
  };

  loadSavedQueries = () => {
    browserHistory.push({
      pathname: `/organizations/${this.props.organization.slug}/discover/`,
      query: {view: 'saved'},
    });
  };

  reset = () => {
    const {savedQuery, queryBuilder, organization} = this.props;
    if (savedQuery) {
      queryBuilder.reset(savedQuery);
      this.setState({
        isEditingSavedQuery: false,
      });
    } else {
      browserHistory.push({
        pathname: `/organizations/${organization.slug}/discover/`,
      });
    }
  };

  deleteSavedQuery = () => {
    const {organization, savedQuery} = this.props;
    const {resultManager} = this.state;

    deleteSavedQuery(organization, savedQuery!.id)
      .then(() => {
        addSuccessMessage(
          tct('Successfully deleted query [name]', {
            name: savedQuery!.name,
          })
        );
        resultManager.reset();
        this.loadSavedQueries();
      })
      .catch(() => {
        addErrorMessage(t('Could not delete query'));
        this.setState({isFetchingQuery: false});
      });
  };

  updateSavedQuery = (name: string) => {
    const {queryBuilder, savedQuery, organization, toggleEditMode} = this.props;
    const query = queryBuilder.getInternal();

    const data = {...query, name};

    updateSavedQuery(organization, savedQuery!.id, data)
      .then((resp: SavedQuery) => {
        addSuccessMessage(t('Updated query'));
        toggleEditMode(); // Return to read-only mode
        this.props.updateSavedQueryData(resp);
      })
      .catch(() => {
        addErrorMessage(t('Could not update query'));
      });
  };

  onGoLegacyDiscover = () => {
    localStorage.setItem('discover:version', '2');
    const user = ConfigStore.get('user');
    trackAnalyticsEvent({
      eventKey: 'discover_v2.opt_in',
      eventName: 'Discoverv2: Go to discover2',
      organization_id: parseInt(this.props.organization.id, 10),
      user_id: parseInt(user.id, 10),
    });
  };

  renderSidebarNav() {
    const {view} = this.state;
    const views = [
      {id: 'query', title: t('New query')},
      {id: 'saved', title: t('Saved queries')},
    ];

    return (
      <Fragment>
        <SidebarTabs underlined>
          {views.map(({id, title}) => (
            <li key={id} className={view === id ? 'active' : ''}>
              <a onClick={() => this.toggleSidebar(id)}>{title}</a>
            </li>
          ))}
        </SidebarTabs>
      </Fragment>
    );
  }

  render() {
    const {data, isFetchingQuery, view, resultManager, isEditingSavedQuery} = this.state;

    const {
      queryBuilder,
      organization,
      savedQuery,
      toggleEditMode,
      isLoading,
      location,
      utc,
    } = this.props;

    const shouldDisplayResult = resultManager.shouldDisplayResult();

    return (
      <DiscoverContainer>
        <Sidebar>
          {this.renderSidebarNav()}
          {view === 'saved' && (
            <SavedQueryWrapper>
              <SavedQueryList organization={organization} savedQuery={savedQuery} />
            </SavedQueryWrapper>
          )}
          {view === 'query' && (
            <NewQuery
              organization={organization}
              queryBuilder={queryBuilder}
              isFetchingQuery={isFetchingQuery || isLoading}
              onUpdateField={this.updateField}
              onRunQuery={this.runQuery}
              onReset={this.reset}
              isLoading={isLoading}
            />
          )}
          {isEditingSavedQuery && savedQuery && (
            <QueryPanel title={t('Edit Query')} onClose={toggleEditMode}>
              <EditSavedQuery
                savedQuery={savedQuery}
                queryBuilder={queryBuilder}
                isFetchingQuery={isFetchingQuery}
                onUpdateField={this.updateField}
                onRunQuery={this.runQuery}
                onDeleteQuery={this.deleteSavedQuery}
                onSaveQuery={this.updateSavedQuery}
                isLoading={isLoading}
              />
            </QueryPanel>
          )}
        </Sidebar>

        <DiscoverGlobalSelectionHeader
          organization={organization}
          hasCustomRouting
          showEnvironmentSelector={false}
          onChangeProjects={this.updateProjects}
          onUpdateProjects={this.runQuery}
          onChangeTime={this.changeTime}
          onUpdateTime={this.updateDateTimeAndRun}
        />
        <Body>
          <BodyContent>
            {shouldDisplayResult && (
              <Result
                location={location}
                utc={utc}
                data={data}
                savedQuery={savedQuery}
                onToggleEdit={toggleEditMode}
                onFetchPage={this.onFetchPage}
              />
            )}
            {!shouldDisplayResult && (
              <Fragment>
                <div>
                  <HeadingContainer>
                    <PageHeading>{t('Discover')}</PageHeading>
                  </HeadingContainer>
                </div>
                <Intro updateQuery={this.updateAndRunQuery} />
              </Fragment>
            )}
            {isFetchingQuery && <ResultLoading />}
          </BodyContent>
        </Body>
      </DiscoverContainer>
    );
  }
}
