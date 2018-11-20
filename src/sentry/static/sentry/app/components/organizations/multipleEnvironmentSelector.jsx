import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';

import {fetchOrganizationEnvironments} from 'app/actionCreators/environments';
import {t} from 'app/locale';
import CheckboxFancy from 'app/components/checkboxFancy';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import HeaderItem from 'app/components/organizations/headerItem';
import Highlight from 'app/components/highlight';
import InlineSvg from 'app/components/inlineSvg';
import LoadingIndicator from 'app/components/loadingIndicator';
import SentryTypes from 'app/sentryTypes';
import theme from 'app/utils/theme';
import withApi from 'app/utils/withApi';

const rootClassName = css`
  position: relative;
  display: flex;
  left: -1px;
`;

/**
 * Environment Selector
 *
 * Note we only fetch environments when this component is mounted
 */
class MultipleEnvironmentSelector extends React.PureComponent {
  static propTypes = {
    // Handler whenever selector values are changed
    onChange: PropTypes.func.isRequired,

    organization: SentryTypes.Organization,

    // This component must be controlled using a value array
    value: PropTypes.array,

    // When menu is closed
    onUpdate: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.state = {
      selectedEnvs: new Set(props.value),
      hasChanges: false,
    };
  }

  /**
   * If value in state is different than value from props, propagate changes
   */
  doChange = (value, e) => {
    this.props.onChange(value, e);
  };

  /**
   * Checks if "onUpdate" is callable. Only calls if there are changes
   */
  doUpdate = () => {
    this.setState({hasChanges: false}, this.props.onUpdate);
  };

  /**
   * Toggle selected state of an environment
   */
  toggleSelected = (env, e) => {
    this.setState(state => {
      const selectedEnvs = new Set(state.selectedEnvs);

      if (selectedEnvs.has(env.name)) {
        selectedEnvs.delete(env.name);
      } else {
        selectedEnvs.add(env.name);
      }

      this.doChange(Array.from(selectedEnvs.values()), e);

      return {
        selectedEnvs,
        hasChanges: true,
      };
    });
  };

  /**
   * Calls "onUpdate" callback and closes the dropdown menu
   */
  handleUpdate = actions => {
    actions.close();
    this.doUpdate();
  };

  handleClose = () => {
    // Only update if there are changes
    if (!this.state.hasChanges) return;
    this.doUpdate();
  };

  /**
   * Clears all selected environments and updates
   */
  handleClear = () => {
    this.setState(
      {
        hasChanges: false,
        selectedEnvs: new Set(),
      },
      () => {
        this.doChange([]);
        this.doUpdate();
      }
    );
  };

  /**
   * Selects an environment, should close menu and initiate an update
   */
  handleSelect = ({value: env}, e) => {
    this.setState(state => {
      this.doChange([env.name], e);

      return {
        selectedEnvs: new Set([env.name]),
      };
    }, this.doUpdate);
  };

  /**
   * Handler for when an environment is selected by the multiple select component
   * Does not initiate an "update"
   */
  handleMultiSelect = (env, e) => {
    this.toggleSelected(env, e);
  };

  render() {
    const {value, organization} = this.props;
    const summary = value && value.length ? `${value.join(', ')}` : t('All Environments');

    return (
      <FetchOrganizationEnvironments organization={organization}>
        {({environments}) => (
          <StyledDropdownAutoComplete
            alignMenu="left"
            closeOnSelect={true}
            blendCorner={false}
            searchPlaceholder={t('Filter environments')}
            onSelect={this.handleSelect}
            onClose={this.handleClose}
            maxHeight={500}
            rootClassName={rootClassName}
            zIndex={theme.zIndex.dropdown}
            inputProps={{style: {padding: 8, paddingLeft: 14}}}
            emptyMessage={
              environments === null ? <LoadingIndicator /> : t('You have no environments')
            }
            noResultsMessage={t('No environments found')}
            virtualizedHeight={40}
            emptyHidesInput
            menuProps={{style: {position: 'relative'}}}
            items={
              environments
                ? environments.map(env => ({
                    value: env,
                    searchKey: env.name,
                    label: ({inputValue}) => (
                      <EnvironmentSelectorItem
                        environment={env}
                        multi={true}
                        inputValue={inputValue}
                        isChecked={this.state.selectedEnvs.has(env.name)}
                        onMultiSelect={this.handleMultiSelect}
                      />
                    ),
                  }))
                : []
            }
          >
            {({isOpen, getActorProps, actions}) => (
              <StyledHeaderItem
                icon={<StyledInlineSvg src="icon-window" />}
                isOpen={isOpen}
                hasSelected={value && !!value.length}
                hasChanges={this.state.hasChanges}
                onSubmit={() => this.handleUpdate(actions)}
                onClear={this.handleClear}
                {...getActorProps({
                  isStyled: true,
                })}
              >
                {summary}
              </StyledHeaderItem>
            )}
          </StyledDropdownAutoComplete>
        )}
      </FetchOrganizationEnvironments>
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
`;

const StyledInlineSvg = styled(InlineSvg)`
  transform: translateY(-2px);
  height: 17px;
  width: 17px;
`;

const StyledDropdownAutoComplete = styled(DropdownAutoComplete)`
  background: #fff;
  border: 1px solid ${p => p.theme.borderLight};
  position: absolute;
  top: 100%;
  box-shadow: ${p => p.theme.dropShadowLight};
  border-radius: 0;
  margin-top: 0;
  min-width: 120%;
`;

class EnvironmentSelectorItem extends React.PureComponent {
  static propTypes = {
    onMultiSelect: PropTypes.func.isRequired,
    environment: SentryTypes.Environment,
    inputValue: PropTypes.string,
    isChecked: PropTypes.bool,
  };

  handleMultiSelect = e => {
    const {environment, onMultiSelect} = this.props;
    onMultiSelect(environment, e);
  };

  handleClick = e => {
    e.stopPropagation();
    this.handleMultiSelect(e);
  };

  render() {
    const {environment, inputValue, isChecked} = this.props;
    return (
      <EnvironmentRow>
        <div>
          <Highlight text={inputValue}>{environment.name}</Highlight>
        </div>

        <MultiSelectWrapper onClick={this.handleClick}>
          <MultiSelect checked={isChecked} />
        </MultiSelectWrapper>
      </EnvironmentRow>
    );
  }
}
const FlexY = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const EnvironmentRow = styled(FlexY)`
  font-size: 14px;
  font-weight: 400;

  /* thanks bootstrap? */
  input[type='checkbox'] {
    margin: 0;
  }
`;
const MultiSelectWrapper = styled('div')`
  margin: -8px;
  padding: 8px;
`;

const MultiSelect = styled(CheckboxFancy)`
  flex-shrink: 0;
`;
