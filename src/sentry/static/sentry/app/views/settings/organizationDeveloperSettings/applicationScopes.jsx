import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import Switch from 'app/components/switch';

import {API_SCOPES} from 'app/constants';

class ApplicationScopes extends React.Component {
  static propTypes = {
    scopes: PropTypes.arrayOf(PropTypes.string),
    onToggle: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.state = {
      loading: false,
      error: false,
      scopes: new Set(this.props.scopes),
    };
  }

  handleToggleScopes = (scope, e) => {
    let {scopes} = this.state;
    if (scopes.has(scope)) {
      scopes.delete(scope);
    } else {
      scopes.add(scope);
    }

    this.setState(
      state => {
        return {
          scopes: new Set(scopes),
        };
      },
      () => {
        this.props.onToggle(this.props.scopes, scopes, e);
      }
    );
  };

  render() {
    return (
      <ScopesGrid>
        {API_SCOPES.map(scope => {
          return (
            <ScopesGridItemWrapper key={scope}>
              <ScopesGridItem>
                <Flex align="center" flex="1">
                  <ScopesTitle>{scope}</ScopesTitle>
                </Flex>

                <StyledSwitch
                  isActive={this.state.scopes.has(scope)}
                  toggle={this.handleToggleScopes.bind(this, scope)}
                  size="lg"
                />
              </ScopesGridItem>
            </ScopesGridItemWrapper>
          );
        })}
      </ScopesGrid>
    );
  }
}

export default ApplicationScopes;

const StyledSwitch = styled(Switch)`
  margin-left: 6px;
  flex-shrink: 0;
`;

const ScopesGrid = styled('div')`
  display: flex;
  flex-wrap: wrap;
`;

const ScopesGridItem = styled('div')`
  display: flex;
  align-items: center;
  background: ${p => p.theme.whiteDark};
  border-radius: 3px;
  flex: 1;
  padding: 12px;
  height: 100%;
`;

const ScopesGridItemWrapper = styled('div')`
  padding: 12px;
  width: 33%;
`;

const ScopesTitle = styled('div')`
  font-size: 14px;
  font-weight: bold;
  line-height: 1;
  white-space: nowrap;
`;
