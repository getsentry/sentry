import PropTypes from 'prop-types';
import React from 'react';
import {browserHistory} from 'react-router';

import {
  addErrorMessage,
  clearIndicators,
  addSuccessMessage,
} from 'app/actionCreators/indicator';
import {t, tct} from 'app/locale';
import HeaderSeparator from 'app/components/organizations/headerSeparator';
import MultipleProjectSelector from 'app/components/organizations/multipleProjectSelector';
import SentryTypes from 'app/sentryTypes';
import TimeRangeSelector from 'app/components/organizations/timeRangeSelector';

import Result from './result';
import ResultLoading from './result/loading';
import Intro from './intro';
import EarlyAdopterMessage from './earlyAdopterMessage';
import NewQuery from './sidebar/newQuery';
import EditSavedQuery from './sidebar/editSavedQuery';
import SavedQueryList from './sidebar/savedQueryList';
import QueryPanel from './sidebar/queryPanel';

import createResultManager from './resultManager';
import {
  getQueryStringFromQuery,
  getQueryFromQueryString,
  deleteSavedQuery,
  updateSavedQuery,
} from './utils';
import {isValidCondition} from './conditions/utils';
import {isValidAggregation} from './aggregations/utils';
import {
  DiscoverContainer,
  Body,
  BodyContent,
  TopBar,
  Sidebar,
  SidebarTabs,
  PageTitle,
  SavedQueryWrapper,
} from './styles';

import {trackQuery} from './analytics';

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
    if (this.props.savedQuery) {
      this.runQuery();
    }
  }

  componentWillReceiveProps(nextProps) {
    const {queryBuilder, location: {search}, savedQuery, isEditingSavedQuery} = nextProps;
    const currentSearch = this.props.location.search;
    const {resultManager} = this.state;

    if (savedQuery && savedQuery !== this.props.savedQuery) {
      this.setState({view: 'saved'});
      this.runQuery();
    }

    if (isEditingSavedQuery !== this.props.isEditingSavedQuery) {
      this.setState({isEditingSavedQuery});
      return;
    }

    if (currentSearch === search) {
      return;
    }

    // Clear data only if location.search is empty (reset has been called)
    if (!search) {
      const newQuery = getQueryFromQueryString(search);
      queryBuilder.reset(newQuery);
      resultManager.reset();
      this.setState({
        data: resultManager.getAll(),
      });
    }
  }

  updateField = (field, value) => {
    this.props.queryBuilder.updateField(field, value);
    this.forceUpdate();
  };

  updateFields = query => {
    Object.entries(query).forEach(([field, value]) => {
      this.updateField(field, value);
    });
  };

  handleUpdateTime = ({relative, start, end}) => {
    this.updateFields({
      range: relative,
      start,
      end,
    });
  };

  runQuery = () => {
    const {queryBuilder, organization} = this.props;
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

    clearIndicators();

    resultManager
      .fetchAll()
      .then(data => {
        const shouldRedirect = !this.props.params.savedQueryId;

        if (shouldRedirect) {
          browserHistory.push({
            pathname: `/organizations/${organization.slug}/discover/`,
            search: getQueryStringFromQuery(queryBuilder.getInternal()),
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
      {id: 'query', title: t('Query')},
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

    const {queryBuilder, organization, savedQuery, toggleEditMode} = this.props;

    const currentQuery = queryBuilder.getInternal();

    const shouldDisplayResult = resultManager.shouldDisplayResult();

    const projects = organization.projects.filter(project => project.isMember);

    return (
      <DiscoverContainer>
        <Sidebar>
          <PageTitle>{t('Discover')}</PageTitle>
          {this.renderSidebarNav()}
          {view === 'saved' && (
            <SavedQueryWrapper isEditing={isEditingSavedQuery}>
              <SavedQueryList organization={organization} savedQuery={savedQuery} />
            </SavedQueryWrapper>
          )}
          {view === 'query' && (
            <NewQuery
              organization={organization}
              queryBuilder={queryBuilder}
              isFetchingQuery={isFetchingQuery}
              onUpdateField={this.updateField}
              onRunQuery={this.runQuery}
              onReset={this.reset}
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
                />
              </QueryPanel>
            )}
        </Sidebar>
        <Body>
          <TopBar>
            <MultipleProjectSelector
              value={currentQuery.projects}
              organization={organization}
              projects={projects}
              onChange={val => this.updateField('projects', val)}
              onUpdate={this.runQuery}
            />
            <HeaderSeparator />
            <TimeRangeSelector
              showAbsolute={true}
              showRelative={true}
              start={currentQuery.start}
              end={currentQuery.end}
              relative={currentQuery.range}
              onChange={this.handleUpdateTime}
              onUpdate={this.runQuery}
            />
            <HeaderSeparator />
          </TopBar>
          <BodyContent>
            {shouldDisplayResult && (
              <Result
                data={data}
                savedQuery={savedQuery}
                onToggleEdit={toggleEditMode}
                onFetchPage={this.onFetchPage}
              />
            )}
            {!shouldDisplayResult && <Intro updateQuery={this.updateFields} />}
            {isFetchingQuery && <ResultLoading />}
            <EarlyAdopterMessage />
          </BodyContent>
        </Body>
      </DiscoverContainer>
    );
  }
}
