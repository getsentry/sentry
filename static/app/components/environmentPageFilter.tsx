import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import {updateEnvironments} from 'sentry/actionCreators/pageFilters';
import Badge from 'sentry/components/badge';
import MultipleEnvironmentSelector from 'sentry/components/organizations/multipleEnvironmentSelector';
import PageFilterDropdownButton from 'sentry/components/organizations/pageFilters/pageFilterDropdownButton';
import {IconWindow} from 'sentry/icons';
import {t} from 'sentry/locale';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import space from 'sentry/styles/space';
import {trimSlug} from 'sentry/utils/trimSlug';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

type EnvironmentSelectorProps = React.ComponentProps<typeof MultipleEnvironmentSelector>;

type Props = {
  router: WithRouterProps['router'];
  alignDropdown?: EnvironmentSelectorProps['alignDropdown'];
  /**
   * Max character length for the dropdown title. Default is 20. This number
   * is used to determine how many projects to show, and how much to truncate.
   */
  maxTitleLength?: number;

  /**
   * Reset these URL params when we fire actions (custom routing only)
   */
  resetParamsOnChange?: string[];
};

function EnvironmentPageFilter({
  router,
  resetParamsOnChange = [],
  alignDropdown,
  maxTitleLength = 20,
}: Props) {
  const {projects, initiallyLoaded: projectsLoaded} = useProjects();
  const organization = useOrganization();
  const {selection, isReady, desyncedFilters} = useLegacyStore(PageFiltersStore);

  const handleUpdateEnvironments = (environments: string[]) => {
    updateEnvironments(environments, router, {
      save: true,
      resetParams: resetParamsOnChange,
    });
  };

  const customDropdownButton: EnvironmentSelectorProps['customDropdownButton'] = ({
    isOpen,
    getActorProps,
    value,
  }) => {
    const environmentsToShow =
      value[0]?.length + value[1]?.length <= maxTitleLength - 2
        ? value.slice(0, 2)
        : value.slice(0, 1);
    const summary = value.length
      ? environmentsToShow.map(env => trimSlug(env, maxTitleLength)).join(', ')
      : t('All Environments');

    return (
      <PageFilterDropdownButton
        detached
        hideBottomBorder={false}
        isOpen={isOpen}
        highlighted={desyncedFilters.has('environments')}
        {...getActorProps()}
      >
        <DropdownTitle>
          <IconWindow />
          <TitleContainer>
            {summary}
            {!!value.length && value.length > environmentsToShow.length && (
              <Badge text={`+${value.length - environmentsToShow.length}`} />
            )}
          </TitleContainer>
        </DropdownTitle>
      </PageFilterDropdownButton>
    );
  };

  const customLoadingIndicator = (
    <PageFilterDropdownButton showChevron={false} disabled>
      <DropdownTitle>
        <IconWindow />
        {t('Loading\u2026')}
      </DropdownTitle>
    </PageFilterDropdownButton>
  );

  return (
    <MultipleEnvironmentSelector
      organization={organization}
      projects={projects}
      loadingProjects={!projectsLoaded || !isReady}
      selectedProjects={selection.projects}
      value={selection.environments}
      onUpdate={handleUpdateEnvironments}
      customDropdownButton={customDropdownButton}
      customLoadingIndicator={customLoadingIndicator}
      alignDropdown={alignDropdown}
      detached
      showPin
    />
  );
}

const TitleContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1 1 0%;
  margin-left: ${space(1)};
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

const DropdownTitle = styled('div')`
  display: flex;
  overflow: hidden;
  align-items: center;
  flex: 1;
`;

export default withRouter<Props>(EnvironmentPageFilter);
