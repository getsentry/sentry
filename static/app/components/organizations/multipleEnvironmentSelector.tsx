import {Fragment, useEffect, useRef, useState} from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';
import sortBy from 'lodash/sortBy';

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

type Props = WithRouterProps & {
  loadingProjects: boolean;
  /**
   * When menu is closed
   */
  onUpdate: (environments: string[]) => void;
  organization: Organization;
  projects: Project[];
  selectedProjects: number[];
  /**
   * This component must be controlled using a value array
   */
  value: string[];
  /**
   * Aligns dropdown menu to left or right of button
   */
  alignDropdown?: 'left' | 'right';
  customDropdownButton?: (config: {
    getActorProps: GetActorPropsFn;
    isOpen: boolean;
    summary: string;
  }) => React.ReactElement;
  customLoadingIndicator?: React.ReactNode;
  detached?: boolean;
  forceEnvironment?: string;
  /**
   * Show the pin button in the dropdown's header actions
   */
  showPin?: boolean;
};

/**
 * Environment Selector
 *
 * Note we only fetch environments when this component is mounted
 */
function MultipleEnvironmentSelector({
  loadingProjects,
  onUpdate,
  organization,
  projects,
  selectedProjects,
  value,
  alignDropdown,
  customDropdownButton,
  customLoadingIndicator,
  detached,
  forceEnvironment,
  router,
  showPin,
}: Props) {
  const [selectedEnvs, setSelectedEnvs] = useState(value);
  const hasChanges = !isEqual(selectedEnvs, value);

  // Update selected envs value on change
  useEffect(() => {
    setSelectedEnvs(value);
    lastSelectedEnvs.current = selectedEnvs;
  }, [value]);

  // We keep a separate list of selected environments to use for sorting. This
  // allows us to only update it after the list is closed, to avoid the list
  // jumping around while selecting projects.
  const lastSelectedEnvs = useRef(value);

  // Ref to help avoid updating stale selected values
  const didQuickSelect = useRef(false);

  /**
   * Toggle selected state of an environment
   */
  const toggleCheckbox = (environment: string) => {
    const willRemove = selectedEnvs.includes(environment);

    const updatedSelectedEnvs = willRemove
      ? selectedEnvs.filter(env => env !== environment)
      : [...selectedEnvs, environment];

    analytics('environmentselector.toggle', {
      action: willRemove ? 'removed' : 'added',
      path: getRouteStringFromRoutes(router.routes),
      org_id: parseInt(organization.id, 10),
    });

    setSelectedEnvs(updatedSelectedEnvs);
  };

  const handleSave = (actions: MenuFooterChildProps['actions']) => {
    actions.close();
    onUpdate(selectedEnvs);
  };

  const handleMenuClose = () => {
    // Only update if there are changes
    if (!hasChanges || didQuickSelect.current) {
      didQuickSelect.current = false;
      return;
    }

    analytics('environmentselector.update', {
      count: selectedEnvs.length,
      path: getRouteStringFromRoutes(router.routes),
      org_id: parseInt(organization.id, 10),
    });

    onUpdate(selectedEnvs);
  };

  /**
   * Clears all selected environments and updates
   */
  const handleClear = () => {
    analytics('environmentselector.clear', {
      path: getRouteStringFromRoutes(router.routes),
      org_id: parseInt(organization.id, 10),
    });

    setSelectedEnvs([]);
    onUpdate([]);
  };

  const handleQuickSelect = (item: Item) => {
    analytics('environmentselector.direct_selection', {
      path: getRouteStringFromRoutes(router.routes),
      org_id: parseInt(organization.id, 10),
    });

    const selectedEnvironments = [item.value];

    setSelectedEnvs(selectedEnvironments);
    onUpdate(selectedEnvironments);

    // Track that we just did a click select so we don't trigger an update in
    // the close handler.
    didQuickSelect.current = true;
  };

  const config = ConfigStore.getConfig();

  const unsortedEnvironments = projects.flatMap(project => {
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
      (selectedProjects.length === 0 && (project.isMember || config.user.isSuperuser)) ||
      selectedProjects.includes(projectId)
    ) {
      return project.environments;
    }

    return [];
  });

  const uniqueEnvironments = Array.from(new Set(unsortedEnvironments));

  // Sort with the last selected environments at the top
  const environments = sortBy(uniqueEnvironments, env => [
    !lastSelectedEnvs.current.find(e => e === env),
    env,
  ]);

  const validatedValue = value.filter(env => environments.includes(env));
  const summary = validatedValue.length
    ? `${validatedValue.join(', ')}`
    : t('All Environments');

  if (forceEnvironment !== undefined) {
    return (
      <StyledHeaderItem
        data-test-id="global-header-environment-selector"
        icon={<IconWindow />}
        isOpen={false}
        locked
      >
        {forceEnvironment ? forceEnvironment : t('All Environments')}
      </StyledHeaderItem>
    );
  }

  if (loadingProjects && customLoadingIndicator) {
    return <Fragment>{customLoadingIndicator}</Fragment>;
  }

  if (loadingProjects) {
    return (
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
    );
  }

  return (
    <ClassNames>
      {({css}) => (
        <StyledDropdownAutoComplete
          alignMenu={alignDropdown}
          allowActorToggle
          closeOnSelect
          blendCorner={false}
          detached={detached}
          searchPlaceholder={t('Filter environments')}
          onSelect={handleQuickSelect}
          onClose={handleMenuClose}
          maxHeight={500}
          rootClassName={css`
            position: relative;
            display: flex;
          `}
          inputProps={{style: {padding: 8, paddingLeft: 14}}}
          emptyMessage={t('You have no environments')}
          noResultsMessage={t('No environments found')}
          virtualizedHeight={theme.headerSelectorRowHeight}
          emptyHidesInput
          inputActions={
            showPin ? <StyledPinButton size="xsmall" filter="environments" /> : undefined
          }
          menuFooter={({actions}) =>
            hasChanges ? (
              <MultipleSelectorSubmitRow onSubmit={() => handleSave(actions)} />
            ) : null
          }
          items={environments.map(env => ({
            value: env,
            searchKey: env,
            label: ({inputValue}) => (
              <PageFilterRow
                data-test-id={`environment-${env}`}
                checked={selectedEnvs.includes(env)}
                onCheckClick={e => {
                  e.stopPropagation();
                  toggleCheckbox(env);
                }}
              >
                <Highlight text={inputValue}>{env}</Highlight>
              </PageFilterRow>
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
                onClear={handleClear}
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

export default withRouter(MultipleEnvironmentSelector);

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
