import {useState} from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import {updateEnvironments} from 'sentry/actionCreators/pageFilters';
import DropdownButton from 'sentry/components/dropdownButton';
import MultipleEnvironmentSelector from 'sentry/components/organizations/multipleEnvironmentSelector';
import {IconWindow} from 'sentry/icons';
import {t} from 'sentry/locale';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import space from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

type Props = {
  router: WithRouterProps['router'];
  /**
   * Reset these URL params when we fire actions (custom routing only)
   */
  resetParamsOnChange?: string[];
};

function EnvironmentPageFilter({router, resetParamsOnChange = []}: Props) {
  const {projects, initiallyLoaded: projectsLoaded} = useProjects();
  const organization = useOrganization();
  const {selection, pinnedFilters, isReady} = useLegacyStore(PageFiltersStore);

  const [selectedEnvironments, setSelectedEnvironments] = useState<string[] | null>(null);

  const handleChangeEnvironments = (environments: string[] | null) => {
    setSelectedEnvironments(environments);
  };

  const handleUpdateEnvironments = (quickSelectedEnvs?: string[]) => {
    updateEnvironments(quickSelectedEnvs || selectedEnvironments, router, {
      save: true,
      resetParams: resetParamsOnChange,
    });
  };

  const customDropdownButton = ({isOpen, getActorProps, summary}) => {
    return (
      <StyledDropdownButton isOpen={isOpen} {...getActorProps()}>
        <DropdownTitle>
          <IconWindow />
          <TitleContainer>{summary}</TitleContainer>
        </DropdownTitle>
      </StyledDropdownButton>
    );
  };

  const customLoadingIndicator = (
    <StyledDropdownButton showChevron={false} disabled>
      <DropdownTitle>
        <IconWindow />
        {t('Loading\u2026')}
      </DropdownTitle>
    </StyledDropdownButton>
  );

  return (
    <MultipleEnvironmentSelector
      organization={organization}
      projects={projects}
      loadingProjects={!projectsLoaded || !isReady}
      selectedProjects={selection.projects}
      value={selection.environments}
      onChange={handleChangeEnvironments}
      onUpdate={handleUpdateEnvironments}
      customDropdownButton={customDropdownButton}
      customLoadingIndicator={customLoadingIndicator}
      pinned={pinnedFilters.has('environments')}
    />
  );
}

const StyledDropdownButton = styled(DropdownButton)`
  width: 100%;
  height: 40px;
`;

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
`;

export default withRouter(EnvironmentPageFilter);
