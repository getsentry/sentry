import React from 'react';
import styled from 'react-emotion';
import {Flex, Box} from 'grid-emotion';

import createReactClass from 'create-react-class';
import ApiMixin from 'app/mixins/apiMixin';
import OrganizationState from 'app/mixins/organizationState';

import SelectField from 'app/components/forms/selectField';
import MultiSelectField from 'app/components/forms/multiSelectField';
import NumberField from 'app/components/forms/numberField';
import Button from 'app/components/buttons/button';

import {addErrorMessage} from 'app/actionCreators/indicator';

import {t} from 'app/locale';

import createQueryBuilder from './queryBuilder';
import Result from './result';
import Time from './time';
import Project from './project';
import Conditions from './conditions';
import Aggregations from './aggregations';

const OrganizationDiscover = createReactClass({
  displayName: 'OrganizationDiscover',

  mixins: [ApiMixin, OrganizationState],

  getInitialState: function() {
    return {
      queryBuilder: createQueryBuilder({}, this.context.organization.projects),
    };
  },

  runQuery: function() {
    const {slug} = this.context.organization;
    const endpoint = `/organizations/${slug}/discover/`;
    const data = this.state.queryBuilder.getExternal();

    this.api.request(endpoint, {
      method: 'POST',
      data,
      success: result => {
        this.setState({
          result,
        });
      },
      error: err => {
        const message = t('An error occurred');
        addErrorMessage(message);
        this.setState({result: null});
      },
    });
  },

  updateField: function(field, value) {
    this.state.queryBuilder.updateField(field, value);
    this.forceUpdate();
  },

  renderComingSoon: function() {
    return (
      <Flex className="organization-home" justify="center" align="center">
        something is happening here soon :)
      </Flex>
    );
  },

  render: function() {
    const {queryBuilder} = this.state;
    const hasFeature = this.getFeatures().has('internal-catchall');

    if (!hasFeature) return this.renderComingSoon();

    const fieldOptions = queryBuilder.getFieldOptions();

    const orderbyOptions = queryBuilder.getOrderByOptions();

    const query = queryBuilder.getInternal();

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
              projects={this.context.organization.projects}
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
              onChange={val => this.updateField('conditions', val)}
            />
            <Button onClick={this.runQuery} style={{marginTop: 8}} priority="primary">
              {t('Run Query')}
            </Button>
          </Box>
          <Box w={[2 / 3, 2 / 3, 2 / 3, 3 / 4]} pl={2}>
            {this.state.result && <Result result={this.state.result} />}
          </Box>
        </Flex>
      </div>
    );
  },
});

const Header = styled(Flex)`
  font-size: 18px;
`;

const Separator = styled(Box)`
  width: 1px;
  background-color: ${p => p.theme.offWhite};
  margin: 4px 16px;
`;

export default OrganizationDiscover;
