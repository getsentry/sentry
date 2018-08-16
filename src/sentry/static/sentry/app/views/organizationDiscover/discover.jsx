import {Flex, Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import {browserHistory} from 'react-router';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import Button from 'app/components/buttons/button';
import HeaderSeparator from 'app/components/organizations/headerSeparator';
import MultiSelectField from 'app/components/forms/multiSelectField';
import MultipleProjectSelector from 'app/components/organizations/multipleProjectSelector';
import NumberField from 'app/components/forms/numberField';
import SelectField from 'app/components/forms/selectField';
import SentryTypes from 'app/sentryTypes';
import TimeRangeSelector from 'app/components/organizations/timeRangeSelector';

import Aggregations from './aggregations';
import Conditions from './conditions';
import ResultTable from './result/table';
import ResultChart from './result/chart';
import Intro from './intro';

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
      result: null,
      chartData: null,
      chartQuery: null,
      isFetchingQuery: false,
    };
  }

  updateField = (field, value) => {
    this.props.queryBuilder.updateField(field, value);
    this.forceUpdate();
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

    queryBuilder.fetch().then(
      result => {
        const query = queryBuilder.getInternal();
        this.setState({result, isFetchingQuery: false});

        browserHistory.push({
          pathname: `/organizations/${organization.slug}/discover/${getQueryStringFromQuery(
            query
          )}`,
        });
      },
      () => {
        addErrorMessage(t('An error occurred'));
        this.setState({result: null, isFetchingQuery: false});
      }
    );

    // If there are aggregations, get data for chart
    if (queryBuilder.getInternal().aggregations.length > 0) {
      const field = queryBuilder.getExternal().fields[0];
      const chartQuery = {
        ...queryBuilder.getExternal(),
        groupby: [field, 'time'],
        rollup: 60 * 60 * 24,
        orderby: '-count',
        limit: 15,
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
      result: null,
      chartData: null,
      chartQuery: null,
    });
    browserHistory.push({
      pathname: `/organizations/${organization.slug}/discover/`,
    });
  };
  render() {
    const {result, chartData, chartQuery, isFetchingQuery} = this.state;
    const {queryBuilder} = this.props;

    const query = queryBuilder.getInternal();
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
              value={query.projects}
              projects={this.props.organization.projects}
              onChange={val => this.updateField('projects', val)}
              onUpdate={this.runQuery}
            />
            <HeaderSeparator />
            <TimeRangeSelector
              start={query.start}
              end={query.end}
              onChange={(name, val) => this.updateField(name, val)}
              onUpdate={this.runQuery}
            />
          </Flex>
        </Header>
        <Flex px={2}>
          <Box w={[1 / 3, 1 / 3, 1 / 3, 1 / 4]}>
            <Fieldset>
              <MultiSelectField
                name="fields"
                label={t('Summarize')}
                placeholder={this.getSummarizePlaceholder()}
                options={fieldOptions}
                value={query.fields}
                onChange={val => this.updateField('fields', val)}
              />
            </Fieldset>
            <Fieldset>
              <Aggregations
                value={query.aggregations}
                columns={columns}
                onChange={val => this.updateField('aggregations', val)}
              />
            </Fieldset>
            <Fieldset>
              <Conditions
                value={query.conditions}
                columns={columnsForConditions}
                onChange={val => this.updateField('conditions', val)}
              />
            </Fieldset>
            <Fieldset>
              <SelectField
                name="orderby"
                label={t('Order By')}
                placeholder={<PlaceholderText>{t('Order by...')}</PlaceholderText>}
                options={this.getOrderbyOptions()}
                value={query.orderby}
                onChange={val => this.updateField('orderby', val)}
              />
            </Fieldset>
            <Fieldset>
              <NumberField
                name="limit"
                label={t('Limit')}
                placeholder="#"
                value={query.limit}
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
          <Box w={[2 / 3, 2 / 3, 2 / 3, 3 / 4]} pl={2}>
            {chartData && <ResultChart data={chartData} query={chartQuery} />}
            {result && <ResultTable result={result} />}
            {!result && <Intro />}
          </Box>
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
