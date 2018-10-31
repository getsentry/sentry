import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import Switch from 'app/components/switch';
<<<<<<< HEAD
<<<<<<< HEAD
=======
import {t} from 'app/locale';
>>>>>>> feat(app-platform): Add UI for adding sentry apps
=======
>>>>>>> fix js tests

import {API_SCOPES} from 'app/constants';

class ApplicationScopes extends React.Component {
  static propTypes = {
<<<<<<< HEAD
    scopes: PropTypes.arrayOf(PropTypes.string),
=======
    scopes: PropTypes.array,
>>>>>>> feat(app-platform): Add UI for adding sentry apps
    onToggle: PropTypes.func,
  };

  constructor(props) {
    super(props);
<<<<<<< HEAD
    this.state = {
      loading: false,
      error: false,
      scopes: new Set(this.props.scopes),
=======
    let initialScopes = new Set(this.props.scopes);
    this.state = {
      loading: false,
      error: false,
      scopes: initialScopes,
>>>>>>> feat(app-platform): Add UI for adding sentry apps
    };
  }

  handleToggleScopes = (scope, e) => {
<<<<<<< HEAD
    this.setState(
      state => {
        let {scopes} = this.state;
        if (scopes.has(scope)) {
          scopes.delete(scope);
        } else {
          scopes.add(scope);
        }
        return {
          scopes: new Set(scopes),
        };
      },
      () => {
        this.props.onToggle(this.props.scopes, this.state.scopes, e);
=======
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
<<<<<<< HEAD
        this.props.onToggle(this.props.data, scopes, e);
>>>>>>> feat(app-platform): Add UI for adding sentry apps
=======
        this.props.onToggle(this.props.scopes, scopes, e);
>>>>>>> use org sentry app endpoint & styling
      }
    );
  };

  render() {
<<<<<<< HEAD
<<<<<<< HEAD
=======
    let {scopes} = this.props;
>>>>>>> feat(app-platform): Add UI for adding sentry apps
=======
>>>>>>> fix js tests
    return (
      <ScopesGrid>
        {API_SCOPES.map(scope => {
          return (
            <ScopesGridItemWrapper key={scope}>
              <ScopesGridItem>
                <Flex align="center" flex="1">
<<<<<<< HEAD
                  <ScopesTitle>{scope}</ScopesTitle>
                </Flex>

                <StyledSwitch
                  isActive={this.state.scopes.has(scope)}
=======
                  <div>
                    <ScopesTitle>{scope}</ScopesTitle>
                  </div>
                </Flex>

                <Switch
                  isActive={this.state.scopes.has(scope)}
                  css={{flexShrink: 0, marginLeft: 6}}
>>>>>>> feat(app-platform): Add UI for adding sentry apps
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

<<<<<<< HEAD
const StyledSwitch = styled(Switch)`
  margin-left: 6px;
  flex-shrink: 0;
`;

const ScopesGrid = styled('div')`
=======
const ScopesGrid = styled.div`
>>>>>>> feat(app-platform): Add UI for adding sentry apps
  display: flex;
  flex-wrap: wrap;
`;

<<<<<<< HEAD
const ScopesGridItem = styled('div')`
=======
const ScopesGridItem = styled.div`
>>>>>>> feat(app-platform): Add UI for adding sentry apps
  display: flex;
  align-items: center;
  background: ${p => p.theme.whiteDark};
  border-radius: 3px;
  flex: 1;
  padding: 12px;
  height: 100%;
`;

<<<<<<< HEAD
const ScopesGridItemWrapper = styled('div')`
=======
const ScopesGridItemWrapper = styled.div`
>>>>>>> feat(app-platform): Add UI for adding sentry apps
  padding: 12px;
  width: 33%;
`;

<<<<<<< HEAD
const ScopesTitle = styled('div')`
=======
const ScopesTitle = styled.div`
>>>>>>> feat(app-platform): Add UI for adding sentry apps
  font-size: 14px;
  font-weight: bold;
  line-height: 1;
  white-space: nowrap;
`;
