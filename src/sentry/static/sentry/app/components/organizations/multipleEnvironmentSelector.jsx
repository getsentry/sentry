import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';
import {uniq, intersection} from 'lodash';

import {analytics} from 'app/utils/analytics';
import getRouteStringFromRoutes from 'app/utils/getRouteStringFromRoutes';
import {t} from 'app/locale';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import GlobalSelectionHeaderRow from 'app/components/globalSelectionHeaderRow';
import HeaderItem from 'app/components/organizations/headerItem';
import Highlight from 'app/components/highlight';
import InlineSvg from 'app/components/inlineSvg';
import MultipleSelectorSubmitRow from 'app/components/organizations/multipleSelectorSubmitRow';
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

    selectedProjects: PropTypes.arrayOf(PropTypes.number),

    // This component must be controlled using a value array
    value: PropTypes.array,

    // When menu is closed
    onUpdate: PropTypes.func,
  };

  static defaultProps = {
    value: [],
  };

  static contextTypes = {
    router: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.state = {
      selectedEnvs: new Set(props.value),
      hasChanges: false,
    };
  }

  componentDidUpdate(prevProps, prevState) {
    // When projects change we may need to update the selected value if the current values
    // become invalid.
    const sharedProjects = intersection(
      prevProps.selectedProjects,
      this.props.selectedProjects
    );
    if (sharedProjects.length !== prevProps.selectedProjects.length) {
      const selectedEnvs = Array.from(this.state.selectedEnvs.values());
      const validEnvironments = this.getEnvironments();
      const newSelection = validEnvironments.filter(env => selectedEnvs.includes(env));

      if (newSelection.length !== selectedEnvs.length) {
        this.replaceSelected(newSelection);
      }
    }
  }

  replaceSelected(newSelection) {
    this.setState({selectedEnvs: new Set(newSelection)});
    this.props.onChange(newSelection);
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

      if (selectedEnvs.has(env)) {
        selectedEnvs.delete(env);
      } else {
        selectedEnvs.add(env);
      }

      analytics('environmentselector.toggle', {
        action: selectedEnvs.has(env) ? 'added' : 'removed',
        path: getRouteStringFromRoutes(this.context.router.routes),
        org_id: parseInt(this.props.organization.id, 10),
      });

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
    if (!this.state.hasChanges) {
      return;
    }

    analytics('environmentselector.update', {
      count: this.state.selectedEnvs.size,
      path: getRouteStringFromRoutes(this.context.router.routes),
      org_id: parseInt(this.props.organization.id, 10),
    });

    this.doUpdate();
  };

  /**
   * Clears all selected environments and updates
   */
  handleClear = () => {
    analytics('environmentselector.clear', {
      path: getRouteStringFromRoutes(this.context.router.routes),
      org_id: parseInt(this.props.organization.id, 10),
    });

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
    analytics('environmentselector.direct_selection', {
      path: getRouteStringFromRoutes(this.context.router.routes),
      org_id: parseInt(this.props.organization.id, 10),
    });

    this.setState(state => {
      this.doChange([env], e);

      return {
        selectedEnvs: new Set([env]),
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

  getEnvironments() {
    const {organization, selectedProjects} = this.props;
    let environments = [];
    organization.projects.forEach(function(project) {
      const projectId = parseInt(project.id, 10);
      // When selectedProjects is empty all projects are selected.
      if (selectedProjects.includes(projectId) || selectedProjects.length === 0) {
        environments = environments.concat(project.environments);
      }
    });

    return uniq(environments);
  }

  render() {
    const {value} = this.props;
    const environments = this.getEnvironments();

    const validatedValue = value.filter(env => environments.includes(env));
    const summary = validatedValue.length
      ? `${validatedValue.join(', ')}`
      : t('All Environments');

    return (
      <StyledDropdownAutoComplete
        alignMenu="left"
        allowActorToggle={true}
        closeOnSelect={true}
        blendCorner={false}
        searchPlaceholder={t('Filter environments')}
        onSelect={this.handleSelect}
        onClose={this.handleClose}
        maxHeight={500}
        rootClassName={rootClassName}
        zIndex={theme.zIndex.dropdown}
        inputProps={{style: {padding: 8, paddingLeft: 14}}}
        emptyMessage={t('You have no environments')}
        noResultsMessage={t('No environments found')}
        virtualizedHeight={theme.headerSelectorRowHeight}
        emptyHidesInput
        menuProps={{style: {position: 'relative'}}}
        menuFooter={({actions}) =>
          this.state.hasChanges && (
            <MultipleSelectorSubmitRow onSubmit={() => this.handleUpdate(actions)} />
          )
        }
        items={environments.map(env => ({
          value: env,
          searchKey: env,
          label: ({inputValue}) => (
            <EnvironmentSelectorItem
              environment={env}
              multi={true}
              inputValue={inputValue}
              isChecked={this.state.selectedEnvs.has(env)}
              onMultiSelect={this.handleMultiSelect}
            />
          ),
        }))}
      >
        {({isOpen, getActorProps, actions}) => (
          <StyledHeaderItem
            icon={<StyledInlineSvg src="icon-window" />}
            isOpen={isOpen}
            hasSelected={value && !!value.length}
            onClear={this.handleClear}
            {...getActorProps({
              isStyled: true,
            })}
          >
            {summary}
          </StyledHeaderItem>
        )}
      </StyledDropdownAutoComplete>
    );
  }
}

export default withApi(MultipleEnvironmentSelector);

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
  border: 1px solid ${p => p.theme.borderDark};
  position: absolute;
  top: 100%;
  box-shadow: ${p => p.theme.dropShadowLight};
  border-radius: ${p => p.theme.borderRadiusBottom};
  margin-top: 0;
  min-width: 120%;
`;

class EnvironmentSelectorItem extends React.PureComponent {
  static propTypes = {
    onMultiSelect: PropTypes.func.isRequired,
    environment: PropTypes.string.isRequired,
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
      <GlobalSelectionHeaderRow checked={isChecked} onCheckClick={this.handleClick}>
        <Highlight text={inputValue}>{environment}</Highlight>
      </GlobalSelectionHeaderRow>
    );
  }
}
