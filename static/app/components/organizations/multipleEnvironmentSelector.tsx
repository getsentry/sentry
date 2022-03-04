import * as React from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';
import uniq from 'lodash/uniq';

import {Client} from 'sentry/api';
import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import {MenuFooterChildProps} from 'sentry/components/dropdownAutoComplete/menu';
import {Item} from 'sentry/components/dropdownAutoComplete/types';
import {GetActorPropsFn} from 'sentry/components/dropdownMenu';
import Highlight from 'sentry/components/highlight';
import HeaderItem from 'sentry/components/organizations/headerItem';
import MultipleSelectorSubmitRow from 'sentry/components/organizations/multipleSelectorSubmitRow';
import PageFilterRow from 'sentry/components/organizations/pageFilterRow';
import PageFilterPinButton from 'sentry/components/organizations/pageFilters/pageFilterPinButton';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {IconWindow} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {analytics} from 'sentry/utils/analytics';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import theme from 'sentry/utils/theme';
import withApi from 'sentry/utils/withApi';

type DefaultProps = {
  /**
   * This component must be controlled using a value array
   */
  value: string[];
};

type Props = WithRouterProps & {
  api: Client;
  loadingProjects: boolean;
  /**
   * Handler whenever selector values are changed
   */
  onChange: (environments: string[]) => void;
  /**
   * When menu is closed
   */
  onUpdate: (selectedEnvs?: string[]) => void;
  organization: Organization;
  projects: Project[];
  selectedProjects: number[];
  customDropdownButton?: (config: {
    getActorProps: GetActorPropsFn;
    isOpen: boolean;
    summary: string;
  }) => React.ReactElement;
  customLoadingIndicator?: React.ReactNode;
  detached?: boolean;
  forceEnvironment?: string;
} & DefaultProps;

type State = {
  hasChanges: boolean;
  selectedEnvs: Set<string>;
};

/**
 * Environment Selector
 *
 * Note we only fetch environments when this component is mounted
 */
class MultipleEnvironmentSelector extends React.PureComponent<Props, State> {
  static defaultProps: DefaultProps = {
    value: [],
  };

  state: State = {
    selectedEnvs: new Set(this.props.value),
    hasChanges: false,
  };

  componentDidUpdate(prevProps: Props) {
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
  doChange = (environments: string[]) => {
    this.props.onChange(environments);
  };

  /**
   * Checks if "onUpdate" is callable. Only calls if there are changes
   * @param selectedEnvs optional parameter passed to onUpdate representing
   * an array containing a directly selected environment (not multi-selected)
   */
  doUpdate = (selectedEnvs?: string[]) => {
    this.setState({hasChanges: false}, () => this.props.onUpdate(selectedEnvs));
  };

  /**
   * Toggle selected state of an environment
   */
  toggleSelected = (environment: string) => {
    this.setState(state => {
      const selectedEnvs = new Set(state.selectedEnvs);

      if (selectedEnvs.has(environment)) {
        selectedEnvs.delete(environment);
      } else {
        selectedEnvs.add(environment);
      }

      analytics('environmentselector.toggle', {
        action: selectedEnvs.has(environment) ? 'added' : 'removed',
        path: getRouteStringFromRoutes(this.props.router.routes),
        org_id: parseInt(this.props.organization.id, 10),
      });

      this.doChange(Array.from(selectedEnvs.values()));

      return {
        selectedEnvs,
        hasChanges: true,
      };
    });
  };

  /**
   * Calls "onUpdate" callback and closes the dropdown menu
   */
  handleUpdate = (actions: MenuFooterChildProps['actions']) => {
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
      path: getRouteStringFromRoutes(this.props.router.routes),
      org_id: parseInt(this.props.organization.id, 10),
    });

    this.doUpdate();
  };

  /**
   * Clears all selected environments and updates
   */
  handleClear = () => {
    analytics('environmentselector.clear', {
      path: getRouteStringFromRoutes(this.props.router.routes),
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
  handleSelect = (item: Item) => {
    const {value: environment} = item;
    analytics('environmentselector.direct_selection', {
      path: getRouteStringFromRoutes(this.props.router.routes),
      org_id: parseInt(this.props.organization.id, 10),
    });

    const envSelection = [environment];

    this.setState(
      () => {
        this.doChange(envSelection);

        return {
          selectedEnvs: new Set(envSelection),
        };
      },
      () => this.doUpdate(envSelection)
    );
  };

  /**
   * Handler for when an environment is selected by the multiple select component
   * Does not initiate an "update"
   */
  handleMultiSelect = (environment: string) => {
    this.toggleSelected(environment);
  };

  getEnvironments() {
    const {projects, selectedProjects} = this.props;
    const config = ConfigStore.getConfig();
    let environments: Project['environments'] = [];
    projects.forEach(function (project) {
      const projectId = parseInt(project.id, 10);
      // Include environments from:
      // - all projects if the user is a superuser
      // - the requested projects
      // - all member projects if 'my projects' (empty list) is selected.
      // - all projects if -1 is the only selected project.
      if (
        (selectedProjects.length === 1 &&
          selectedProjects[0] === ALL_ACCESS_PROJECTS &&
          project.hasAccess) ||
        (selectedProjects.length === 0 &&
          (project.isMember || config.user.isSuperuser)) ||
        selectedProjects.includes(projectId)
      ) {
        environments = environments.concat(project.environments);
      }
    });

    return uniq(environments);
  }

  render() {
    const {
      value,
      loadingProjects,
      customDropdownButton,
      customLoadingIndicator,
      forceEnvironment,
      detached,
    } = this.props;
    const environments = this.getEnvironments();

    const hasNewPageFilters =
      this.props.organization.features.includes('selection-filters-v2');

    const validatedValue = value.filter(env => environments.includes(env));
    const summary = validatedValue.length
      ? `${validatedValue.join(', ')}`
      : t('All Environments');

    return forceEnvironment !== undefined ? (
      <StyledHeaderItem
        data-test-id="global-header-environment-selector"
        icon={<IconWindow />}
        isOpen={false}
        locked
      >
        {forceEnvironment ? forceEnvironment : t('All Environments')}
      </StyledHeaderItem>
    ) : loadingProjects ? (
      customLoadingIndicator ?? (
        <StyledHeaderItem
          data-test-id="global-header-environment-selector"
          icon={<IconWindow />}
          loading={loadingProjects}
          hasChanges={false}
          hasSelected={false}
          isOpen={false}
          locked={false}
        >
          {t('Loading\u2026')}
        </StyledHeaderItem>
      )
    ) : (
      <ClassNames>
        {({css}) => (
          <StyledDropdownAutoComplete
            alignMenu="left"
            allowActorToggle
            closeOnSelect
            blendCorner={false}
            detached={detached}
            searchPlaceholder={t('Filter environments')}
            onSelect={this.handleSelect}
            onClose={this.handleClose}
            maxHeight={500}
            rootClassName={css`
              position: relative;
              display: flex;
              left: -1px;
            `}
            inputProps={{style: {padding: 8, paddingLeft: 14}}}
            emptyMessage={t('You have no environments')}
            noResultsMessage={t('No environments found')}
            virtualizedHeight={theme.headerSelectorRowHeight}
            emptyHidesInput
            inputActions={
              hasNewPageFilters ? (
                <StyledPinButton size="xsmall" filter="environments" />
              ) : undefined
            }
            menuFooter={({actions}) =>
              this.state.hasChanges ? (
                <MultipleSelectorSubmitRow onSubmit={() => this.handleUpdate(actions)} />
              ) : null
            }
            items={environments.map(env => ({
              value: env,
              searchKey: env,
              label: ({inputValue}) => (
                <EnvironmentSelectorItem
                  environment={env}
                  inputValue={inputValue}
                  isChecked={this.state.selectedEnvs.has(env)}
                  onMultiSelect={this.handleMultiSelect}
                />
              ),
            }))}
          >
            {({isOpen, getActorProps}) =>
              customDropdownButton ? (
                customDropdownButton({isOpen, getActorProps, summary})
              ) : (
                <StyledHeaderItem
                  data-test-id="global-header-environment-selector"
                  icon={<IconWindow />}
                  isOpen={isOpen}
                  hasSelected={value && !!value.length}
                  onClear={this.handleClear}
                  hasChanges={false}
                  locked={false}
                  loading={false}
                  {...getActorProps()}
                >
                  {summary}
                </StyledHeaderItem>
              )
            }
          </StyledDropdownAutoComplete>
        )}
      </ClassNames>
    );
  }
}

export default withApi(withRouter(MultipleEnvironmentSelector));

const StyledHeaderItem = styled(HeaderItem)`
  height: 100%;
  width: 100%;
`;

const StyledDropdownAutoComplete = styled(DropdownAutoComplete)`
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  position: absolute;
  top: 100%;

  ${p =>
    !p.detached &&
    `
    margin-top: 0;
    border-radius: ${p.theme.borderRadiusBottom};
  `};
`;

const StyledPinButton = styled(PageFilterPinButton)`
  margin: 0 ${space(1)};
`;

type EnvironmentSelectorItemProps = {
  environment: string;
  inputValue: string;
  isChecked: boolean;
  onMultiSelect: (environment: string) => void;
};

class EnvironmentSelectorItem extends React.PureComponent<EnvironmentSelectorItemProps> {
  handleMultiSelect = () => {
    const {environment, onMultiSelect} = this.props;
    onMultiSelect(environment);
  };

  handleClick = (e: React.MouseEvent<Element, MouseEvent>) => {
    e.stopPropagation();
    this.handleMultiSelect();
  };

  render() {
    const {environment, inputValue, isChecked} = this.props;
    return (
      <PageFilterRow
        data-test-id={`environment-${environment}`}
        checked={isChecked}
        onCheckClick={this.handleClick}
      >
        <Highlight text={inputValue}>{environment}</Highlight>
      </PageFilterRow>
    );
  }
}
