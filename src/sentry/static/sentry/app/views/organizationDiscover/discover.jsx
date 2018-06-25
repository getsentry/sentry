import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {Flex, Box} from 'grid-emotion';

import SentryTypes from 'app/proptypes';
import SelectField from 'app/components/forms/selectField';
import MultiSelectField from 'app/components/forms/multiSelectField';
import NumberField from 'app/components/forms/numberField';
import Button from 'app/components/buttons/button';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';

import Result from './result';
import Time from './time';
import Project from './project';
import Conditions from './conditions';
import Aggregations from './aggregations';

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
            <Project
              value={query.projects}
              projects={this.props.organization.projects}
              onChange={val => this.updateField('projects', val)}
              runQuery={this.runQuery}
            />
            <Separator />
            <Time
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

const Separator = styled(Box)`
  width: 1px;
  background-color: ${p => p.theme.offWhite};
  margin: 4px 16px;
`;
