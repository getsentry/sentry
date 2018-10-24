import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import Switch from 'app/components/switch';
import {t} from 'app/locale';

import {API_SCOPES} from 'app/constants';

class ApplicationScopes extends React.Component {
  static propTypes = {
    scopes: PropTypes.array,
    onToggle: PropTypes.func,
  };

  constructor(props) {
    super(props);
    let initialScopes = new Set(this.props.scopes);
    this.state = {
      loading: false,
      error: false,
      scopes: initialScopes,
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
      {
        scopes: new Set(scopes),
      },
      () => {
        this.props.onToggle(this.props.data, scopes, e);
      }
    );
  };

  render() {
    let {scopes} = this.props;
    return (
      <ScopesGrid>
        {API_SCOPES.map(scope => {
          return (
            <ScopesGridItemWrapper key={scope}>
              <ScopesGridItem>
                <Flex align="center" flex="1">
                  <div>
                    <ScopesTitle>{scope}</ScopesTitle>
                  </div>
                </Flex>

                <Switch
                  isActive={this.state.scopes.has(scope)}
                  css={{flexShrink: 0, marginLeft: 6}}
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

const ScopesGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
`;

const ScopesGridItem = styled.div`
  display: flex;
  align-items: center;
  background: ${p => p.theme.whiteDark};
  border-radius: 3px;
  flex: 1;
  padding: 12px;
  height: 100%;
`;

const ScopesGridItemWrapper = styled.div`
  padding: 12px;
  width: 33%;
`;

const ScopesTitle = styled.div`
  font-size: 14px;
  font-weight: bold;
  line-height: 1;
  white-space: nowrap;
`;
