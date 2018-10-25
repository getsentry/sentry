import PropTypes from 'prop-types';
import React from 'react';
import {Flex} from 'grid-emotion';

import {t} from 'app/locale';
import Button from 'app/components/button';
import * as conditionsUtils from '../conditions/utils';
import * as aggregationsUtils from '../aggregations/utils';

import {Fieldset, PlaceholderText, SidebarLabel, ButtonSpinner} from '../styles';

export default class QueryRead extends React.Component {
  static propTypes = {
    queryBuilder: PropTypes.object.isRequired,
    isFetchingQuery: PropTypes.bool.isRequired,
    onRunQuery: PropTypes.func.isRequired,
  };

  renderAggregations(aggregations) {
    if (!aggregations.length) {
      return <PlaceholderText>{t('No aggregations selected')}</PlaceholderText>;
    }

    return aggregations.map((aggregation, index) => (
      <PlaceholderText key={index}>
        {aggregationsUtils.getInternal(aggregation)}
      </PlaceholderText>
    ));
  }

  renderConditions(conditions) {
    if (!conditions.length) {
      return <PlaceholderText>{t('No conditions selected')}</PlaceholderText>;
    }

    return conditions.map((condition, index) => (
      <PlaceholderText key={index}>
        {conditionsUtils.getInternal(condition)}
      </PlaceholderText>
    ));
  }

  render() {
    const {queryBuilder, onRunQuery, isFetchingQuery} = this.props;

    const currentQuery = queryBuilder.getInternal();

    return (
      <React.Fragment>
        <Fieldset>
          <SidebarLabel className="control-label">{t('Summarize')}</SidebarLabel>
          <PlaceholderText>
            {currentQuery.fields.join(', ') || t('No fields selected')}
          </PlaceholderText>
        </Fieldset>
        <Fieldset>
          <SidebarLabel className="control-label">{t('Aggregations')}</SidebarLabel>
          {this.renderAggregations(currentQuery.aggregations)}
        </Fieldset>
        <Fieldset>
          <SidebarLabel className="control-label">{t('Conditions')}</SidebarLabel>
          {this.renderConditions(currentQuery.conditions)}
        </Fieldset>
        <Fieldset>
          <SidebarLabel className="control-label">{t('Order by')}</SidebarLabel>
          <PlaceholderText>
            {currentQuery.orderby || t('No orderby value selected')}
          </PlaceholderText>
        </Fieldset>
        <Fieldset>
          <SidebarLabel className="control-label">{t('Limit')}</SidebarLabel>
          <PlaceholderText>
            {currentQuery.limit || t('No limit provided')}
          </PlaceholderText>
        </Fieldset>

        <Fieldset>
          <Flex>
            <Button
              size="xsmall"
              onClick={onRunQuery}
              priority="primary"
              busy={isFetchingQuery}
            >
              {t('Run')}
              {isFetchingQuery && <ButtonSpinner />}
            </Button>
          </Flex>
        </Fieldset>
      </React.Fragment>
    );
  }
}
