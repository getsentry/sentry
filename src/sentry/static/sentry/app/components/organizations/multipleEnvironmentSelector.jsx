import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {fetchOrganizationEnvironments} from 'app/actionCreators/environments';
import {t} from 'app/locale';
import space from 'app/styles/space';
import Button from 'app/components/button';
import DropdownMenu from 'app/components/dropdownMenu';
import LoadingIndicator from 'app/components/loadingIndicator';
import MultiSelectField from 'app/components/forms/multiSelectField';
import SentryTypes from 'app/sentryTypes';
import withApi from 'app/utils/withApi';

import HeaderItem from 'app/components/organizations/headerItem';
import InlineSvg from 'app/components/inlineSvg';

/**
 * Environment Selector
 */
class MultipleEnvironmentSelector extends React.Component {
  static propTypes = {
    onChange: PropTypes.func,
    onUpdate: PropTypes.func,
    organization: SentryTypes.Organization,

    // This component must be controlled using a value array
    value: PropTypes.array,
  };

  constructor() {
    super();
    this.state = {
      isOpen: false,
    };
  }

  handleUpdate = actions => {
    let {value, onUpdate} = this.props;
    this.setState(
      {
        isOpen: false,
      },
      () => {
        if (typeof onUpdate === 'function') {
          onUpdate(value);
        }
      }
    );
  };

  handleClear = () => {
    let {onChange, onUpdate} = this.props;
    this.setState(
      {
        isOpen: false,
      },
      () => {
        onChange([]);
        if (typeof onUpdate === 'function') {
          onUpdate([]);
        }
      }
    );
  };

  render() {
    const {value, onChange, organization} = this.props;
    const summary = value && value.length ? `${value.join(', ')}` : t('All Environments');

    return (
      <DropdownMenu
        isOpen={this.state.isOpen}
        onOpen={() => this.setState({isOpen: true})}
        onClose={() => this.setState({isOpen: false})}
        keepMenuOpen={true}
      >
        {({isOpen, getRootProps, getActorProps, getMenuProps, actions}) => (
          <div {...getRootProps()} style={{position: 'relative'}}>
            <StyledHeaderItem
              icon={<StyledInlineSvg src="icon-window" />}
              isOpen={isOpen}
              hasSelected={value && !!value.length}
              onClear={this.handleClear}
              {...getActorProps({isStyled: true})}
            >
              {summary}
            </StyledHeaderItem>
            {isOpen && (
              <Menu {...getMenuProps({isStyled: true})}>
                <FetchOrganizationEnvironments organization={organization}>
                  {({environments}) => (
                    <React.Fragment>
                      {environments === null && <LoadingIndicator />}
                      {!!environments && (
                        <React.Fragment>
                          <MultiSelectField
                            name="environments"
                            value={value}
                            choices={environments.map(env => [env.name, env.name])}
                            onChange={onChange}
                          />
                        </React.Fragment>
                      )}
                      <Button
                        data-test-id="update-envs"
                        onClick={() => this.handleUpdate(actions)}
                      >
                        {t('Update')}
                      </Button>
                    </React.Fragment>
                  )}
                </FetchOrganizationEnvironments>
              </Menu>
            )}
          </div>
        )}
      </DropdownMenu>
    );
  }
}

export default withApi(MultipleEnvironmentSelector);

const FetchOrganizationEnvironments = withApi(
  class FetchOrganizationEnvironments extends React.Component {
    static propTypes = {
      api: PropTypes.object,
      organization: SentryTypes.Organization,
    };
    constructor(props) {
      super(props);
      this.state = {
        environments: null,
      };
    }

    componentDidMount() {
      let {api, organization} = this.props;
      fetchOrganizationEnvironments(api, organization.slug).then(environments =>
        this.setState({environments})
      );
    }
    render() {
      let {children} = this.props;
      return children({
        environments: this.state.environments,
      });
    }
  }
);

const StyledHeaderItem = styled(HeaderItem)`
  height: 100%;
  width: 250px;
`;

const StyledInlineSvg = styled(InlineSvg)`
  transform: translateY(-2px);
  height: 17px;
  width: 17px;
`;

const Menu = styled('div')`
  background: #fff;
  border: 1px solid ${p => p.theme.borderLight};
  position: absolute;
  top: 100%;
  left: -1px;
  min-width: 120%;
  z-index: ${p => p.theme.zIndex.dropdown};
  box-shadow: ${p => p.theme.dropShadowLight};
  padding: ${space(2)};
  border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
`;
