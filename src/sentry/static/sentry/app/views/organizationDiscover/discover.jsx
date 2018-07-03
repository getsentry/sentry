import {Flex, Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import Button from 'app/components/buttons/button';
import HeaderSeparator from 'app/components/organizations/headerSeparator';
import MultiSelectField from 'app/components/forms/multiSelectField';
import MultipleProjectSelector from 'app/components/organizations/multipleProjectSelector';
import NumberField from 'app/components/forms/numberField';
import SelectField from 'app/components/forms/selectField';
import SentryTypes from 'app/proptypes';
import TimeRangeSelector from 'app/components/organizations/timeRangeSelector';

import Aggregations from './aggregations';
import Conditions from './conditions';
import Result from './result';

import {isValidCondition} from './conditions/utils';
import {isValidAggregation} from './aggregations/utils';

export default class OrganizationDiscover extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    queryBuilder: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.state = {
      result: null,
    };
  }

  updateField = (field, value) => {
    this.props.queryBuilder.updateField(field, value);
    this.forceUpdate();
  };

  runQuery = () => {
    const {queryBuilder} = this.props;
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

    this.props.queryBuilder.fetch().then(
      result => this.setState({result}),
      () => {
        addErrorMessage(t('An error occurred'));
        this.setState({result: null});
      }
    );
  };

  render() {
    const {result} = this.state;
    const {queryBuilder} = this.props;

    const query = queryBuilder.getInternal();
    const columns = queryBuilder.getColumns();

    const fieldOptions = columns.map(({name}) => ({
      value: name,
      label: name,
    }));

    const orderbyOptions = columns.reduce((acc, {name}) => {
      return [
        ...acc,
        {value: name, label: `${name} asc`},
        {value: `-${name}`, label: `${name} desc`},
      ];
    }, []);

    return (
      <div className="organization-home">
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
              runQuery={this.runQuery}
            />
            <HeaderSeparator />
            <TimeRangeSelector
              start={query.start}
              end={query.end}
              updateField={(name, val) => this.updateField(name, val)}
              runQuery={this.runQuery}
            />
          </Flex>
        </Header>
        <Flex px={2}>
          <Box w={[1 / 3, 1 / 3, 1 / 3, 1 / 4]}>
            <MultiSelectField
              name="fields"
              label={t('Summarize')}
              options={fieldOptions}
              value={query.fields}
              onChange={val => this.updateField('fields', val)}
            />
            <Aggregations
              value={query.aggregations}
              columns={columns}
              onChange={val => this.updateField('aggregations', val)}
            />
            <SelectField
              name="orderby"
              label={t('Order By')}
              options={orderbyOptions}
              value={query.orderby}
              onChange={val => this.updateField('orderby', val)}
            />
            <NumberField
              name="limit"
              label={t('Limit')}
              value={query.limit}
              onChange={val =>
                this.updateField('limit', typeof val === 'number' ? val : null)}
            />
            <Conditions
              value={query.conditions}
              columns={columns}
              onChange={val => this.updateField('conditions', val)}
            />
            <Button onClick={this.runQuery} style={{marginTop: 8}} priority="primary">
              {t('Run Query')}
            </Button>
          </Box>
          <Box w={[2 / 3, 2 / 3, 2 / 3, 3 / 4]} pl={2}>
            {result && <Result result={result} />}
          </Box>
        </Flex>
      </div>
    );
  }
}

const Header = styled(Flex)`
  font-size: 18px;
`;
