import PropTypes from 'prop-types';
import React from 'react';
import {browserHistory} from 'react-router';
import {isEqual} from 'lodash';

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
import Intro from './intro';
import EarlyAdopterMessage from './earlyAdopterMessage';
import QueryEdit from './sidebar/queryEdit';
import QueryRead from './sidebar/queryRead';
import SavedQueryList from './sidebar/savedQueryList';

import createResultManager from './resultManager';
import {
  getQueryStringFromQuery,
  getQueryFromQueryString,
  deleteSavedQuery,
  updateSavedQuery,
  parseSavedQuery,
} from './utils';
import {isValidCondition} from './conditions/utils';
import {isValidAggregation} from './aggregations/utils';
import {
  Discover,
  Body,
  BodyContent,
  TopBar,
  Sidebar,
  SidebarTabs,
  SavedQueryTitle,
  SavedQueryAction,
  PageTitle,
  EditableName,
  BackToQueryList,
} from './styles';

import {trackQuery} from './analytics';

export default class OrganizationDiscover extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    queryBuilder: PropTypes.object.isRequired,
    savedQuery: SentryTypes.DiscoverSavedQuery, // Provided if it's a saved search
    updateSavedQueryData: PropTypes.func.isRequired,
    view: PropTypes.oneOf(['query', 'saved']),
  };

  constructor(props) {
    super(props);
    const resultManager = createResultManager(props.queryBuilder);
    this.state = {
      resultManager,
      data: resultManager.getAll(),
      isFetchingQuery: false,
      isEditingSavedQuery: false,
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
    const {queryBuilder, location: {search}} = nextProps;
    const currentSearch = this.props.location.search;
    const {resultManager} = this.state;

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
    const {queryBuilder, organization, savedQuery} = this.props;
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

    resultManager.fetchAll().then(data => {
      const shouldRedirect = !savedQuery;

      if (shouldRedirect) {
        browserHistory.push({
          pathname: `/organizations/${organization.slug}/discover/`,
          search: getQueryStringFromQuery(queryBuilder.getInternal()),
        });
      }

      this.setState({data, isFetchingQuery: false});
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

  toggleEditMode = () => {
    this.setState(state => {
      const isEditMode = !state.isEditingSavedQuery;
      return {
        isEditingSavedQuery: isEditMode,
        savedQueryName: isEditMode ? this.props.savedQuery.name : null,
      };
    });
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
    deleteSavedQuery(organization, savedQuery.id)
      .then(() => {
        addSuccessMessage(
          tct('Successfully deleted query [name]', {
            name: savedQuery.name,
          })
        );
        this.loadSavedQueries();
      })
      .catch(() => {
        addErrorMessage(t('Could not delete query'));
        this.setState({isFetchingQuery: false});
      });
  };

  updateSavedQueryName = savedQueryName => {
    this.setState({savedQueryName});
  };

  updateSavedQuery = () => {
    const {queryBuilder, savedQuery, organization} = this.props;
    const query = queryBuilder.getInternal();
    const hasChanged =
      !isEqual(query, parseSavedQuery(savedQuery)) ||
      savedQuery.name !== this.state.savedQueryName;

    const data = {...query, name: this.state.savedQueryName};

    if (hasChanged) {
      updateSavedQuery(organization, savedQuery.id, data)
        .then(resp => {
          addSuccessMessage(t('Updated query'));
          this.toggleEditMode(); // Return to read-only mode
          this.props.updateSavedQueryData(resp);
          this.runQuery();
        })
        .catch(() => {
          addErrorMessage(t('Could not update query'));
        });
    } else {
      this.toggleEditMode(); // Return to read-only mode
    }
  };

  renderSidebarNav() {
    const {view, isEditingSavedQuery} = this.state;
    const {savedQuery} = this.props;
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
        {savedQuery && (
          <React.Fragment>
            <BackToQueryList>
              <a onClick={this.loadSavedQueries}>
                {tct('[arr] Back to saved query list', {arr: '←'})}
              </a>
            </BackToQueryList>
            <SavedQueryTitle>
              {!isEditingSavedQuery && (
                <React.Fragment>
                  {savedQuery.name}
                  <SavedQueryAction onClick={this.toggleEditMode}>
                    {t('Edit query')}
                  </SavedQueryAction>
                </React.Fragment>
              )}
              {isEditingSavedQuery && (
                <React.Fragment>
                  <EditableName
                    value={savedQuery.name}
                    onChange={this.updateSavedQueryName}
                  />
                  <SavedQueryAction onClick={this.updateSavedQuery}>
                    {t('Save changes')}
                  </SavedQueryAction>
                  <SavedQueryAction onClick={this.deleteSavedQuery}>
                    {t('Delete')}
                  </SavedQueryAction>
                </React.Fragment>
              )}
            </SavedQueryTitle>
          </React.Fragment>
        )}
      </React.Fragment>
    );
  }

  render() {
    const {data, isFetchingQuery, view, resultManager, isEditingSavedQuery} = this.state;
    const {queryBuilder, organization, savedQuery} = this.props;

    const currentQuery = queryBuilder.getInternal();

    const shouldDisplayResult = resultManager.shouldDisplayResult();
    const shouldRenderSavedList = view === 'saved' && !savedQuery;
    const shouldRenderReadMode = view === 'saved' && savedQuery && !isEditingSavedQuery;
    const shouldRenderEditMode =
      (view === 'saved' && savedQuery && isEditingSavedQuery) ||
      (view === 'query' && !savedQuery);

    const projects = organization.projects.filter(project => project.isMember);

    return (
      <Discover>
        <Sidebar>
          <PageTitle>{t('Discover')}</PageTitle>
          {this.renderSidebarNav()}
          {shouldRenderReadMode && (
            <QueryRead
              queryBuilder={queryBuilder}
              isFetchingQuery={isFetchingQuery}
              onRunQuery={this.runQuery}
            />
          )}
          {shouldRenderEditMode && (
            <QueryEdit
              queryBuilder={queryBuilder}
              isFetchingQuery={isFetchingQuery}
              onUpdateField={this.updateField}
              onRunQuery={this.runQuery}
              reset={this.reset}
            />
          )}
          {shouldRenderSavedList && <SavedQueryList organization={organization} />}
        </Sidebar>
        <Body direction="column" flex="1">
          <TopBar>
            <MultipleProjectSelector
              value={currentQuery.projects}
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
          </TopBar>
          <BodyContent>
            {shouldDisplayResult && (
              <Result
                data={data}
                organization={organization}
                savedQuery={savedQuery}
                queryBuilder={queryBuilder}
              />
            )}
            {!shouldDisplayResult && <Intro updateQuery={this.updateFields} />}
            <EarlyAdopterMessage />
          </BodyContent>
        </Body>
      </Discover>
    );
  }
}
