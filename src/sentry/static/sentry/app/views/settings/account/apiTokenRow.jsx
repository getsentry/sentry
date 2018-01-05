import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from '../../../locale';
import Button from '../../../components/buttons/button';
import DateTime from '../../../components/dateTime';
import Row from '../components/row';
import TextCopyInput from '../components/forms/textCopyInput';

const ScopeList = styled.div`
  font-size: 0.9em;
  color: #999;
`;

const Created = styled.div`
  font-size: 0.9em;
`;

class ApiTokenRow extends React.Component {
  static propTypes = {
    token: PropTypes.object.isRequired,
    onRemove: PropTypes.func.isRequired,
  };

  handleRemove = () => {
    let {onRemove, token} = this.props;
    onRemove(token);
  };

  render() {
    let {token} = this.props;

    return (
      <Row justify="space-between" px={2} py={2}>
        <Box flex="1">
          <div style={{marginBottom: 5}}>
            <small>
              <TextCopyInput
                flexValueContainer={false}
                renderer={({value, ref}) => (
                  <Flex align="center" ref={ref}>
                    {value}
                  </Flex>
                )}
              >
                {token.token}
              </TextCopyInput>
            </small>
          </div>
          <div style={{marginBottom: 5}}>
            <Created>
              {t('Created')} <DateTime date={token.dateCreated} />
            </Created>
          </div>
          <div>
            <ScopeList>{token.scopes.join(', ')}</ScopeList>
          </div>
        </Box>

        <Flex align="center">
          <Box pl={2}>
            <Button onClick={this.handleRemove}>
              <span className="icon icon-trash" />
            </Button>
          </Box>
        </Flex>
      </Row>
    );
  }
}

export default ApiTokenRow;
