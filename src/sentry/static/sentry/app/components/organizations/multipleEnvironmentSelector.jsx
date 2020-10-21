import {ClassNames} from '@emotion/core';
import PropTypes from 'prop-types';
import {PureComponent} from 'react';
import styled from '@emotion/styled';
import uniq from 'lodash/uniq';

import {analytics} from 'app/utils/analytics';
import getRouteStringFromRoutes from 'app/utils/getRouteStringFromRoutes';
import {ALL_ACCESS_PROJECTS} from 'app/constants/globalSelectionHeader';
import {t} from 'app/locale';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import GlobalSelectionHeaderRow from 'app/components/globalSelectionHeaderRow';
import HeaderItem from 'app/components/organizations/headerItem';
import Highlight from 'app/components/highlight';
import MultipleSelectorSubmitRow from 'app/components/organizations/multipleSelectorSubmitRow';
import SentryTypes from 'app/sentryTypes';
import theme from 'app/utils/theme';
import withApi from 'app/utils/withApi';
import {IconWindow} from 'app/icons';

/**
 * Environment Selector
 *
 * Note we only fetch environments when this component is mounted
 */
class MultipleEnvironmentSelector extends PureComponent {
  static propTypes = {
    // Handler whenever selector values are changed
    onChange: PropTypes.func.isRequired,

    organization: SentryTypes.Organization,

    projects: PropTypes.arrayOf(SentryTypes.Project),

    loadingProjects: PropTypes.bool,

    selectedProjects: PropTypes.arrayOf(PropTypes.number),

    // This component must be controlled using a value array
    value: PropTypes.array,

    // When menu is closed
    onUpdate: PropTypes.func,
  };

  static contextTypes = {
    router: PropTypes.object,
  };

  static defaultProps = {
    value: [],
  };

  constructor(props) {
    super(props);
    this.state = {
      selectedEnvs: new Set(props.value),
      hasChanges: false,
    };
  }

  componentDidUpdate(prevProps) {
    // Need to sync state
    if (this.props.value !== prevProps.value) {
      this.syncSelectedStateFromProps();
    }
  }

  syncSelectedStateFromProps = () =>
    this.setState({selectedEnvs: new Set(this.props.value)});

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

    this.setState(() => {
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
    const {projects, selectedProjects} = this.props;
    let environments = [];
    projects.forEach(function (project) {
      const projectId = parseInt(project.id, 10);

      // Include environments from:
      // - the requested projects
      // - all member projects if 'my projects' (empty list) is selected.
      // - all projects if -1 is the only selected project.
      if (
        (selectedProjects.length === 1 &&
          selectedProjects[0] === ALL_ACCESS_PROJECTS &&
          project.hasAccess) ||
        (selectedProjects.length === 0 && project.isMember) ||
        selectedProjects.includes(projectId)
      ) {
        environments = environments.concat(project.environments);
      }
    });

    return uniq(environments);
  }

  render() {
    const {value, loadingProjects} = this.props;
    const environments = this.getEnvironments();

    const validatedValue = value.filter(env => environments.includes(env));
    const summary = validatedValue.length
      ? `${validatedValue.join(', ')}`
      : t('All Environments');

    return loadingProjects ? (
      <StyledHeaderItem
        data-test-id="global-header-environment-selector"
        icon={<IconWindow />}
        loading={loadingProjects}
      >
        {t('Loading\u2026')}
      </StyledHeaderItem>
    ) : (
      <ClassNames>
        {({css}) => (
          <StyledDropdownAutoComplete
            alignMenu="left"
            allowActorToggle
            closeOnSelect
            blendCorner={false}
            searchPlaceholder={t('Filter environments')}
            onSelect={this.handleSelect}
            onClose={this.handleClose}
            maxHeight={500}
            rootClassName={css`
              position: relative;
              display: flex;
              left: -1px;
            `}
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
                  multi
                  inputValue={inputValue}
                  isChecked={this.state.selectedEnvs.has(env)}
                  onMultiSelect={this.handleMultiSelect}
                />
              ),
            }))}
          >
            {({isOpen, getActorProps}) => (
              <StyledHeaderItem
                data-test-id="global-header-environment-selector"
                icon={<IconWindow />}
                isOpen={isOpen}
                hasSelected={value && !!value.length}
                onClear={this.handleClear}
                {...getActorProps()}
              >
                {summary}
              </StyledHeaderItem>
            )}
          </StyledDropdownAutoComplete>
        )}
      </ClassNames>
    );
  }
}

export default withApi(MultipleEnvironmentSelector);

const StyledHeaderItem = styled(HeaderItem)`
  height: 100%;
`;

const StyledDropdownAutoComplete = styled(DropdownAutoComplete)`
  background: #fff;
  border: 1px solid ${p => p.theme.borderDark};
  position: absolute;
  top: 100%;
  box-shadow: ${p => p.theme.dropShadowLight};
  border-radius: ${p => p.theme.borderRadiusBottom};
  margin-top: 0;
  min-width: 100%;
`;

class EnvironmentSelectorItem extends PureComponent {
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
      <GlobalSelectionHeaderRow
        data-test-id={`environment-${environment}`}
        checked={isChecked}
        onCheckClick={this.handleClick}
      >
        <Highlight text={inputValue}>{environment}</Highlight>
      </GlobalSelectionHeaderRow>
    );
  }
}
