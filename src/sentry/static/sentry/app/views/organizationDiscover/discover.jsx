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
import {Fieldset, PlaceholderText} from './styles';

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

  getOrderbyOptions = () => {
    const {queryBuilder} = this.props;
    const columns = queryBuilder.getColumns();
    const query = queryBuilder.getInternal();

    // If there are aggregations, only allow summarized fields in orderby
    const hasAggregations = query.aggregations.length > 0;
    const hasFields = query.fields.length > 0;

    return columns.reduce((acc, {name}) => {
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
  };

  getSummarizePlaceholder = () => {
    const {queryBuilder} = this.props;
    const query = queryBuilder.getInternal();
    const text =
      query.aggregations.length > 0
        ? t('Select fields')
        : t('None selected, using all fields');
    return <PlaceholderText>{text}</PlaceholderText>;
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
                columns={columns}
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
