import PropTypes from 'prop-types';
import React from 'react';
import {Flex, Box} from 'grid-emotion';
import {browserHistory} from 'react-router';

import Button from 'app/components/button';
import {t, tct} from 'app/locale';
import {addSuccessMessage, addErrorMessage} from 'app/actionCreators/indicator';
import SentryTypes from 'app/sentryTypes';

import QueryFields from './queryFields';
import {createSavedQuery, generateQueryName} from '../utils';
import {ButtonSpinner} from '../styles';

export default class NewQuery extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    queryBuilder: PropTypes.object.isRequired,
    onRunQuery: PropTypes.func.isRequired,
    onReset: PropTypes.func.isRequired,
    onUpdateField: PropTypes.func.isRequired,
    isFetchingQuery: PropTypes.bool.isRequired,
  };

  saveQuery() {
    const {organization, queryBuilder} = this.props;
    const savedQueryName = generateQueryName();
    const data = {...queryBuilder.getInternal(), name: savedQueryName};

    createSavedQuery(organization, data)
      .then(savedQuery => {
        addSuccessMessage(tct('Successfully saved query [name]', {name: savedQueryName}));
        browserHistory.push({
          pathname: `/organizations/${organization.slug}/discover/saved/${savedQuery.id}/`,
          query: {editing: true},
        });
      })
      .catch(err => {
        const message = (err && err.detail) || t('Could not save query');
        addErrorMessage(message);
      });
  }

  render() {
    const {
      queryBuilder,
      onRunQuery,
      onReset,
      isFetchingQuery,
      onUpdateField,
    } = this.props;
    return (
      <QueryFields
        queryBuilder={queryBuilder}
        onUpdateField={onUpdateField}
        actions={
          <Flex justify="space-between">
            <Flex>
              <Box mr={1}>
                <Button
                  size="xsmall"
                  onClick={onRunQuery}
                  priority="primary"
                  busy={isFetchingQuery}
                >
                  {t('Run')}
                  {isFetchingQuery && <ButtonSpinner />}
                </Button>
              </Box>
              <Box>
                <Button size="xsmall" onClick={() => this.saveQuery()}>
                  {t('Save')}
                </Button>
              </Box>
            </Flex>
            <Box>
              <Button size="xsmall" onClick={onReset}>
                {t('Reset')}
              </Button>
            </Box>
          </Flex>
        }
      />
    );
  }
}
