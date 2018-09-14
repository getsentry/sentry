import {Flex, Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import {browserHistory} from 'react-router';
import {uniq} from 'lodash';

import {addErrorMessage, clearIndicators} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import Button from 'app/components/button';
import HeaderSeparator from 'app/components/organizations/headerSeparator';
import MultipleProjectSelector from 'app/components/organizations/multipleProjectSelector';
import NumberField from 'app/components/forms/numberField';
import SelectControl from 'app/components/forms/selectControl';
import SentryTypes from 'app/sentryTypes';
import TimeRangeSelector from 'app/components/organizations/timeRangeSelector';
import space from 'app/styles/space';

import Aggregations from './aggregations';
import Conditions from './conditions';
import Result from './result';
import Intro from './intro';
import EarlyAdopterMessage from './earlyAdopterMessage';

import {isValidCondition} from './conditions/utils';
import {isValidAggregation} from './aggregations/utils';
import {
  Discover,
  Sidebar,
  TopBar,
  SidebarHeader,
  SidebarTitle,
  PageTitle,
  Fieldset,
  PlaceholderText,
  ButtonSpinner,
  SidebarLabel,
} from './styles';

import {getQueryStringFromQuery, getQueryFromQueryString} from './utils';
import {trackQuery} from './analytics';

export default class OrganizationDiscover extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    queryBuilder: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.state = {
      data: null,
      query: null,
      chartData: null,
      chartQuery: null,
      isFetchingQuery: false,
    };
  }

  componentWillReceiveProps(nextProps) {
    const {queryBuilder, location: {search, action}} = nextProps;
    const currentSearch = this.props.location.search;

    if (currentSearch === search || action === 'REPLACE') {
      return;
    }

    const newQuery = getQueryFromQueryString(search);
    queryBuilder.reset(newQuery);

    this.setState({
      data: null,
      query: null,
      chartData: null,
      chartQuery: null,
    });
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

    // If there are no aggregations, always ensure we fetch event ID and
    // project ID so we can display the link to event
    const externalQuery = queryBuilder.getExternal();
    const queryToFetch =
      !externalQuery.aggregations.length && externalQuery.fields.length
        ? {
            ...externalQuery,
            fields: uniq([...externalQuery.fields, 'event_id', 'project_id']),
          }
        : externalQuery;

    queryBuilder.fetch(queryToFetch).then(
      data => {
        const query = queryBuilder.getInternal();
        const queryCopy = {...query};
        this.setState({data, query: queryCopy, isFetchingQuery: false});

        browserHistory.push({
          pathname: `/organizations/${organization.slug}/discover/${getQueryStringFromQuery(
            query
          )}`,
        });
      },
      err => {
        addErrorMessage(err.message);
        this.setState({data: null, query: null, isFetchingQuery: false});
      }
    );

    // If there are aggregations, get data for chart
    if (queryBuilder.getInternal().aggregations.length > 0) {
      const chartQuery = {
        ...queryBuilder.getExternal(),
        groupby: ['time'],
        rollup: 60 * 60 * 24,
        orderby: 'time',
        limit: 1000,
      };

      queryBuilder.fetch(chartQuery).then(
        chartData => {
          this.setState({chartData, chartQuery});
        },
        () => {
          this.setState({chartData: null, chartQuery: null});
        }
      );
    } else {
      this.setState({chartData: null, chartQuery: null});
    }
  };

  getOrderbyOptions = () => {
    const {queryBuilder} = this.props;
    const columns = queryBuilder.getColumns();
    const query = queryBuilder.getInternal();

    // If there are valid aggregations, only allow summarized fields and aggregations in orderby
    const validAggregations = query.aggregations.filter(agg =>
      isValidAggregation(agg, columns)
    );

    const hasAggregations = validAggregations.length > 0;

    const hasFields = query.fields.length > 0;

    const columnOptions = columns.reduce((acc, {name}) => {
      if (hasAggregations) {
        const isInvalidField = hasFields && !query.fields.includes(name);
        if (!hasFields || isInvalidField) {
          return acc;
        }
      }

      return [
        ...acc,
        {value: name, label: `${name} asc`},
        {value: `-${name}`, label: `${name} desc`},
      ];
    }, []);

    const aggregationOptions = [
      // Ensure aggregations are unique (since users might input duplicates)
      ...new Set(validAggregations.map(aggregation => aggregation[2])),
    ].reduce((acc, agg) => {
      return [
        ...acc,
        {value: agg, label: `${agg} asc`},
        {value: `-${agg}`, label: `${agg} desc`},
      ];
    }, []);

    return [...columnOptions, ...aggregationOptions];
  };

  getSummarizePlaceholder = () => {
    const {queryBuilder} = this.props;
    const query = queryBuilder.getInternal();
    const text =
      query.aggregations.length > 0
        ? t('Select fields')
        : t('No fields selected, showing all');
    return <PlaceholderText>{text}</PlaceholderText>;
  };

  reset = () => {
    browserHistory.push({
      pathname: `/organizations/${this.props.organization.slug}/discover/`,
    });
  };

  render() {
    const {data, query, chartData, chartQuery, isFetchingQuery} = this.state;
    const {queryBuilder} = this.props;

    const currentQuery = queryBuilder.getInternal();
    const columns = queryBuilder.getColumns();
    // Do not allow conditions on projectID field
    const columnsForConditions = columns.filter(({name}) => name !== 'project_id');

    const fieldOptions = columns.map(({name}) => ({
      value: name,
      label: name,
    }));

    return (
      <Discover>
        <Sidebar>
          <PageTitle>{t('Discover')}</PageTitle>
          <SidebarHeader>
            <SidebarTitle>{t('Query')}</SidebarTitle>
            <Box>
              <Button size="xsmall" onClick={this.reset} style={{marginRight: space(1)}}>
                {t('Reset')}
              </Button>
              <Button
                size="xsmall"
                onClick={this.runQuery}
                priority="primary"
                busy={isFetchingQuery}
              >
                {t('Run')}
                {isFetchingQuery && <ButtonSpinner />}
              </Button>
            </Box>
          </SidebarHeader>
          <Fieldset>
            <SidebarLabel htmlFor="fields" className="control-label">
              {t('Summarize')}
            </SidebarLabel>
            <SelectControl
              name="fields"
              multiple={true}
              placeholder={this.getSummarizePlaceholder()}
              options={fieldOptions}
              value={currentQuery.fields}
              onChange={val => this.updateField('fields', val.map(({value}) => value))}
              clearable={true}
            />
          </Fieldset>
          <Fieldset>
            <Aggregations
              value={currentQuery.aggregations}
              columns={columns}
              onChange={val => this.updateField('aggregations', val)}
            />
          </Fieldset>
          <Fieldset>
            <Conditions
              value={currentQuery.conditions}
              columns={columnsForConditions}
              onChange={val => this.updateField('conditions', val)}
            />
          </Fieldset>
          <Fieldset>
            <SidebarLabel htmlFor="orderby" className="control-label">
              {t('Order by')}
            </SidebarLabel>
            <SelectControl
              name="orderby"
              label={t('Order By')}
              placeholder={<PlaceholderText>{t('Order by...')}</PlaceholderText>}
              options={this.getOrderbyOptions()}
              value={currentQuery.orderby}
              onChange={val => this.updateField('orderby', val.value)}
            />
          </Fieldset>
          <Fieldset>
            <NumberField
              name="limit"
              label={<SidebarLabel>{t('Limit')}</SidebarLabel>}
              placeholder="#"
              value={currentQuery.limit}
              onChange={val =>
                this.updateField('limit', typeof val === 'number' ? val : null)}
            />
          </Fieldset>
        </Sidebar>
        <Flex direction="column" flex="1">
          <TopBar>
            <MultipleProjectSelector
              value={currentQuery.projects}
              projects={this.props.organization.projects}
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
          <Flex flex="1" direction="column" p={3}>
            {data && (
              <Result
                data={data}
                query={query}
                chartData={chartData}
                chartQuery={chartQuery}
              />
            )}
            {!data && <Intro updateQuery={this.updateFields} />}
            <EarlyAdopterMessage />
          </Flex>
        </Flex>
      </Discover>
    );
  }
}
