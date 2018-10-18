import PropTypes from 'prop-types';
import React from 'react';
import {Flex, Box} from 'grid-emotion';

import Button from 'app/components/button';
import {t} from 'app/locale';

import QueryFields from './queryFields';
import {ButtonSpinner} from '../styles';

export default class NewQuery extends React.Component {
  static propTypes = {
    onRunQuery: PropTypes.func.isRequired,
    onReset: PropTypes.func.isRequired,
    isFetchingQuery: PropTypes.bool.isRequired,
  };

  render() {
    const {onRunQuery, onReset, isFetchingQuery, ...props} = this.props;
    return (
      <QueryFields
        {...props}
        actions={
          <Flex>
            <Box mr={1}>
              <Button
                size="xsmall"
                onClick={onRunQuery}
                priority="primary"
                busy={isFetchingQuery}
              >
                {t('Run Query')}
                {isFetchingQuery && <ButtonSpinner />}
              </Button>
            </Box>
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
