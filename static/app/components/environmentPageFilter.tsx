import styled from '@emotion/styled';

import {updateEnvironments} from 'sentry/actionCreators/pageFilters';
import Badge from 'sentry/components/badge';
import {EnvironmentPageFilter as NewEnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import EnvironmentSelector from 'sentry/components/organizations/environmentSelector';
import PageFilterDropdownButton from 'sentry/components/organizations/pageFilters/pageFilterDropdownButton';
import PageFilterPinIndicator from 'sentry/components/organizations/pageFilters/pageFilterPinIndicator';
import {IconWindow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {FormSize} from 'sentry/utils/theme';
import {trimSlug} from 'sentry/utils/trimSlug';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';

type EnvironmentSelectorProps = React.ComponentProps<typeof EnvironmentSelector>;

type Props = {
  alignDropdown?: EnvironmentSelectorProps['alignDropdown'];
  disabled?: EnvironmentSelectorProps['disabled'];
  /**
   * Max character length for the dropdown title. Default is 20. This number
   * is used to determine how many projects to show, and how much to truncate.
   */
  maxTitleLength?: number;
  /**
   * Reset these URL params when we fire actions (custom routing only)
   */
  resetParamsOnChange?: string[];
  size?: FormSize;
};

function OldEnvironmentPageFilter({
  resetParamsOnChange = [],
  alignDropdown,
  disabled,
  maxTitleLength = 20,
  size = 'md',
}: Props) {
  const router = useRouter();

  const {projects, initiallyLoaded: projectsLoaded} = useProjects();
  const organization = useOrganization();
  const {selection, isReady, desyncedFilters} = usePageFilters();

  const handleUpdateEnvironments = (environments: string[]) => {
    updateEnvironments(environments, router, {
      save: true,
      resetParams: resetParamsOnChange,
    });
  };

  const customDropdownButton: EnvironmentSelectorProps['customDropdownButton'] = ({
    isOpen,
    value,
  }) => {
    const environmentsToShow =
      value[0]?.length + value[1]?.length <= maxTitleLength - 2
        ? value.slice(0, 2)
        : value.slice(0, 1);
    const summary = value.length
      ? environmentsToShow.map(env => trimSlug(env, maxTitleLength)).join(', ')
      : t('All Envs');

    return (
      <PageFilterDropdownButton
        isOpen={isOpen}
        highlighted={desyncedFilters.has('environments')}
        data-test-id="page-filter-environment-selector"
        disabled={disabled}
        size={size}
        icon={
          <PageFilterPinIndicator filter="environments">
            <IconWindow />
          </PageFilterPinIndicator>
        }
      >
        <TitleContainer>
          {summary}
          {!!value.length && value.length > environmentsToShow.length && (
            <Badge text={`+${value.length - environmentsToShow.length}`} />
          )}
        </TitleContainer>
      </PageFilterDropdownButton>
    );
  };

  const customLoadingIndicator = (
    <PageFilterDropdownButton
      icon={<IconWindow />}
      showChevron={false}
      disabled
      data-test-id="page-filter-environment-selector"
    >
      <TitleContainer>{t('Loading\u2026')}</TitleContainer>
    </PageFilterDropdownButton>
  );

  return (
    <EnvironmentSelector
      organization={organization}
      projects={projects}
      loadingProjects={!projectsLoaded || !isReady}
      selectedProjects={selection.projects}
      value={selection.environments}
      onUpdate={handleUpdateEnvironments}
      customDropdownButton={customDropdownButton}
      customLoadingIndicator={customLoadingIndicator}
      alignDropdown={alignDropdown}
      disabled={disabled}
    />
  );
}

const TitleContainer = styled('div')`
  text-align: left;
  ${p => p.theme.overflowEllipsis}
`;

function EnvironmentPageFilter(props: Props) {
  const organization = useOrganization();

  if (organization.features.includes('new-page-filter')) {
    return <NewEnvironmentPageFilter {...props} />;
  }

  return <OldEnvironmentPageFilter {...props} />;
}

export default EnvironmentPageFilter;
