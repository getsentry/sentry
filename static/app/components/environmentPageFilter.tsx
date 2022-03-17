import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import {updateEnvironments} from 'sentry/actionCreators/pageFilters';
import MultipleEnvironmentSelector from 'sentry/components/organizations/multipleEnvironmentSelector';
import PageFilterDropdownButton from 'sentry/components/organizations/pageFilters/pageFilterDropdownButton';
import {IconWindow} from 'sentry/icons';
import {t} from 'sentry/locale';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import space from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

type Props = {
  router: WithRouterProps['router'];
  alignDropdown?: React.ComponentProps<
    typeof MultipleEnvironmentSelector
  >['alignDropdown'];
  /**
   * Reset these URL params when we fire actions (custom routing only)
   */
  resetParamsOnChange?: string[];
};

function EnvironmentPageFilter({router, resetParamsOnChange = [], alignDropdown}: Props) {
  const {projects, initiallyLoaded: projectsLoaded} = useProjects();
  const organization = useOrganization();
  const {selection, isReady, desyncedFilters} = useLegacyStore(PageFiltersStore);

  const handleUpdateEnvironments = (environments: string[]) => {
    updateEnvironments(environments, router, {
      save: true,
      resetParams: resetParamsOnChange,
    });
  };

  const customDropdownButton = ({isOpen, getActorProps, summary}) => {
    return (
      <PageFilterDropdownButton
        isOpen={isOpen}
        {...getActorProps()}
        highlighted={desyncedFilters.has('environments')}
      >
        <DropdownTitle>
          <IconWindow />
          <TitleContainer>{summary}</TitleContainer>
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
    />
  );
}

const TitleContainer = styled('div')`
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  flex: 1 1 0%;
  margin-left: ${space(1)};
`;

const DropdownTitle = styled('div')`
  display: flex;
  overflow: hidden;
  align-items: center;
  flex: 1;
`;

export default withRouter<Props>(EnvironmentPageFilter);
