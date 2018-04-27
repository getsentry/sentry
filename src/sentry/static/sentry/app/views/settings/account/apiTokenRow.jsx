import {Box, Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import Button from 'app/components/buttons/button';
import DateTime from 'app/components/dateTime';
import {PanelItem} from 'app/components/panels';
import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';

const StyledPanelItem = styled(PanelItem)`
  flex-direction: column;
`;

const Details = styled(Flex)`
  margin-top: 10px;
`;

const ScopeList = styled.div`
  font-size: 0.9em;
  line-height: 1.4;
`;

const Time = styled.time`
  font-size: 0.9em;
  line-height: 1.4;
`;

const Action = styled(Box)`
  align-self: flex-start;
`;

const Heading = styled.div`
  font-size: 13px;
  text-transform: uppercase;
  color: ${p => p.theme.gray3};
  margin-bottom: 8px;
`;

const StyledButton = styled(Button)`
  /* todo(ckj): Buttons need to be refactored to be properly extended by styled.
     For now, we'll need to use a child selector:
  */

  .button-label {
    padding-top: 9px;
    padding-bottom: 9px;
  }
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
      <StyledPanelItem p={2}>
        <div>
          <Flex>
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
            </Box>
            <Action pl={2}>
              <StyledButton
                size="small"
                onClick={this.handleRemove}
                icon="icon-circle-subtract"
              >
                <span className="ref-delete-api-token">{t('Remove')}</span>
              </StyledButton>
            </Action>
          </Flex>
        </div>

        <Details>
          <Box flex="1">
            <Heading>{t('Scopes')}</Heading>
            <ScopeList>{token.scopes.join(', ')}</ScopeList>
          </Box>
          <Box>
            <Heading>{t('Created')}</Heading>
            <Time>
              <DateTime date={token.dateCreated} />
            </Time>
          </Box>
        </Details>
      </StyledPanelItem>
    );
  }
}

export default ApiTokenRow;
