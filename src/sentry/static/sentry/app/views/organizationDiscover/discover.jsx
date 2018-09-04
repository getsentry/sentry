import {Flex, Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import {browserHistory} from 'react-router';

import {addErrorMessage, clearIndicators} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import Button from 'app/components/button';
import HeaderSeparator from 'app/components/organizations/headerSeparator';
import MultipleProjectSelector from 'app/components/organizations/multipleProjectSelector';
import NumberField from 'app/components/forms/numberField';
import SelectControl from 'app/components/forms/selectControl';
import SentryTypes from 'app/sentryTypes';
import TimeRangeSelector from 'app/components/organizations/timeRangeSelector';

import Aggregations from './aggregations';
import Conditions from './conditions';
import Result from './result';
import Intro from './intro';
import EarlyAdopterMessage from './earlyAdopterMessage';

import {isValidCondition} from './conditions/utils';
import {isValidAggregation} from './aggregations/utils';
import {Fieldset, PlaceholderText, ButtonSpinner} from './styles';

import {getQueryStringFromQuery} from './utils';

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

  updateField = (field, value) => {
    this.props.queryBuilder.updateField(field, value);
    this.forceUpdate();
  };

  updateFields = query => {
    Object.entries(query).forEach(([field, value]) => {
      this.updateField(field, value);
    });
  };

  runQuery = () => {
    const {queryBuilder, organization} = this.props;
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

    queryBuilder.fetch().then(
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
    const {queryBuilder, organization} = this.props;

    queryBuilder.reset();
    this.setState({
      data: null,
      chartData: null,
      chartQuery: null,
    });
    browserHistory.push({
      pathname: `/organizations/${organization.slug}/discover/`,
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
      <Discover className="organization-home">
        <Header
          p={2}
          justify="space-between"
          align="center"
          className="sub-header"
          style={{marginBottom: 16}}
        >
          <strong>{t('Discover')}</strong>
          <Flex>
            <MultipleProjectSelector
              value={currentQuery.projects}
              projects={this.props.organization.projects}
              onChange={val => this.updateField('projects', val)}
              onUpdate={this.runQuery}
            />
            <HeaderSeparator />
            <TimeRangeSelector
              start={currentQuery.start}
              end={currentQuery.end}
              onChange={(name, val) => this.updateField(name, val)}
              onUpdate={this.runQuery}
            />
          </Flex>
        </Header>
        <Flex px={2}>
          <Box w={[1 / 3, 1 / 3, 1 / 3, 1 / 4]}>
            <Fieldset>
              <label htmlFor="fields" className="control-label">
                {t('Summarize')}
              </label>
              <SelectControl
                name="fields"
                multiple={true}
                placeholder={this.getSummarizePlaceholder()}
                options={fieldOptions}
                value={currentQuery.fields}
                onChange={val => this.updateField('fields', val.map(({value}) => value))}
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
              <label htmlFor="orderby" className="control-label">
                {t('Order by')}
              </label>
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
                label={t('Limit')}
                placeholder="#"
                value={currentQuery.limit}
                onChange={val =>
                  this.updateField('limit', typeof val === 'number' ? val : null)}
              />
            </Fieldset>

            <Flex pt={1}>
              <Box mr={1}>
                <Button onClick={this.runQuery} priority="primary" busy={isFetchingQuery}>
                  {t('Run Query')}
                  {isFetchingQuery && <ButtonSpinner />}
                </Button>
              </Box>
              <Button onClick={this.reset}>{t('Reset')}</Button>
            </Flex>
          </Box>
          <Flex w={[2 / 3, 2 / 3, 2 / 3, 3 / 4]} pl={2} style={{flexDirection: "column"}}>
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

const Discover = styled('div')`
  .control-group {
    margin-bottom: 0; /* Do not want the global control-group margins  */
  }
`;

const Header = styled(Flex)`
  font-size: 18px;
`;
