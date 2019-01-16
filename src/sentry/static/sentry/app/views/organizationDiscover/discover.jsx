import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {getUtcDateString} from 'app/utils/dates';
import {t, tct} from 'app/locale';
import {updateProjects, updateDateTime} from 'app/actionCreators/globalSelection';
import BetaTag from 'app/components/betaTag';
import SentryTypes from 'app/sentryTypes';
import PageHeading from 'app/components/pageHeading';

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

export default class OrganizationDiscover extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    queryBuilder: PropTypes.object.isRequired,
    // savedQuery and isEditingSavedQuery are provided if it's a saved query
    savedQuery: SentryTypes.DiscoverSavedQuery,
    isEditingSavedQuery: PropTypes.bool,
    updateSavedQueryData: PropTypes.func.isRequired,
    view: PropTypes.oneOf(['query', 'saved']),
    toggleEditMode: PropTypes.func.isRequired,
    isLoading: PropTypes.bool.isRequired,
    utc: PropTypes.bool,
  };

  static defaultProps = {
    utc: true,
  };

  constructor(props) {
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

  componentDidMount() {
    const {savedQuery, location} = this.props;

    // Run query if there is *any* querystring
    if (savedQuery || (location && !!location.search)) {
      this.runQuery();
    }
  }

  componentWillReceiveProps(nextProps) {
    const {
      queryBuilder,
      location: {search},
      savedQuery,
      isEditingSavedQuery,
      params,
    } = nextProps;
    const {resultManager} = this.state;

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
      const {projects, range, start, end} = newQuery;
      let hasChange = false;

      if (projects) {
        this.updateProjects(projects);
        hasChange = true;
      }

      if (range || (end && start)) {
        this.updateDateTime({
          period: range || null,
          start: start || null,
          end: end || null,
        });
        hasChange = true;
      }

      if (hasChange) {
        this.runQuery();
      }
    }
  }

  updateProjects = val => {
    this.updateField('projects', val);
    updateProjects(val);
  };

  getDateTimeFields = ({period, start, end}) => ({
    range: period || null,
    start: (start && getUtcDateString(start)) || null,
    end: (end && getUtcDateString(end)) || null,
  });

  changeTime = datetime => {
    this.updateFields(this.getDateTimeFields(datetime));
  };

  updateDateTime = datetime => {
    const {start, end, range} = this.getDateTimeFields(datetime);

    this.updateFields({start, end, range});
    updateDateTime({
      start,
      end,
      period: range,
    });
  };

  updateDateTimeAndRun = datetime => {
    this.updateDateTime(datetime);
    this.runQuery();
  };

  updateField = (field, value) => {
    this.props.queryBuilder.updateField(field, value);
    this.forceUpdate();
  };

  updateFields = query => {
    Object.entries(query).forEach(([field, value]) => {
      this.updateField(field, value);
    });
  };

  updateAndRunQuery = query => {
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
    const filteredConditions = conditions.filter(condition =>
      isValidCondition(condition, queryBuilder.getColumns())
    );

    const filteredAggregations = aggregations.filter(aggregation =>
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
      .then(data => {
        const shouldRedirect = !this.props.params.savedQueryId;

        if (shouldRedirect) {
          browserHistory.push({
            pathname: `/organizations/${organization.slug}/discover/`,
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
      .catch(err => {
        const message = (err && err.message) || t('An error occurred');
        addErrorMessage(message);
        this.setState({isFetchingQuery: false});
      });
  };

  onFetchPage = nextOrPrev => {
    this.setState({isFetchingQuery: true});
    return this.state.resultManager
      .fetchPage(nextOrPrev)
      .then(data => {
        this.setState({data, isFetchingQuery: false});
      })
      .catch(err => {
        const message = (err && err.message) || t('An error occurred');
        addErrorMessage(message);
        this.setState({isFetchingQuery: false});
      });
  };

  toggleSidebar = view => {
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

    deleteSavedQuery(organization, savedQuery.id)
      .then(() => {
        addSuccessMessage(
          tct('Successfully deleted query [name]', {
            name: savedQuery.name,
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

  updateSavedQuery = name => {
    const {queryBuilder, savedQuery, organization, toggleEditMode} = this.props;
    const query = queryBuilder.getInternal();

    const data = {...query, name};

    updateSavedQuery(organization, savedQuery.id, data)
      .then(resp => {
        addSuccessMessage(t('Updated query'));
        toggleEditMode(); // Return to read-only mode
        this.props.updateSavedQueryData(resp);
      })
      .catch(() => {
        addErrorMessage(t('Could not update query'));
      });
  };

  renderSidebarNav() {
    const {view} = this.state;
    const views = [
      {id: 'query', title: t('New query')},
      {id: 'saved', title: t('Saved queries')},
    ];

    return (
      <React.Fragment>
        <SidebarTabs underlined={true}>
          {views.map(({id, title}) => (
            <li key={id} className={view === id ? 'active' : ''}>
              <a onClick={() => this.toggleSidebar(id)}>{title}</a>
            </li>
          ))}
        </SidebarTabs>
      </React.Fragment>
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
      utc,
    } = this.props;

    const currentQuery = queryBuilder.getInternal();

    const shouldDisplayResult = resultManager.shouldDisplayResult();

    const start =
      (currentQuery.start && moment.utc(currentQuery.start).toDate()) ||
      currentQuery.start;
    const end =
      (currentQuery.end && moment.utc(currentQuery.end).toDate()) || currentQuery.end;

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
          {isEditingSavedQuery &&
            savedQuery && (
              <QueryPanel title={t('Edit Query')} onClose={toggleEditMode}>
                <EditSavedQuery
                  savedQuery={savedQuery}
                  queryBuilder={queryBuilder}
                  isFetchingQuery={isFetchingQuery}
                  onUpdateField={this.updateField}
                  onRunQuery={this.runQuery}
                  onReset={this.reset}
                  onDeleteQuery={this.deleteSavedQuery}
                  onSaveQuery={this.updateSavedQuery}
                  isLoading={isLoading}
                />
              </QueryPanel>
            )}
        </Sidebar>

        <DiscoverGlobalSelectionHeader
          organization={organization}
          project={currentQuery.projects}
          hasCustomRouting={true}
          relative={currentQuery.range}
          start={start}
          end={end}
          utc={utc}
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
                utc={utc}
                data={data}
                savedQuery={savedQuery}
                onToggleEdit={toggleEditMode}
                onFetchPage={this.onFetchPage}
              />
            )}
            {!shouldDisplayResult && (
              <React.Fragment>
                <div>
                  <HeadingContainer>
                    <PageHeading>
                      {t('Discover')} <BetaTag />
                    </PageHeading>
                  </HeadingContainer>
                </div>
                <Intro updateQuery={this.updateAndRunQuery} />
              </React.Fragment>
            )}
            {isFetchingQuery && <ResultLoading />}
          </BodyContent>
        </Body>
      </DiscoverContainer>
    );
  }
}
