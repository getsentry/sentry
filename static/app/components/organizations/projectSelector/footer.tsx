import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import Button from 'sentry/components/button';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {growIn} from 'sentry/styles/animations';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';

type ShowAllButtonProps = {
  canShowAllProjects: boolean;
  onButtonClick: () => void;
};

type FeatureRenderProps = {
  hasFeature: boolean;
  renderShowAllButton?: (p: ShowAllButtonProps) => React.ReactNode;
};

type Props = {
  onApply: () => void;
  onShowAllProjects: () => void;
  onShowMyProjects: () => void;
  organization: Organization;
  disableMultipleProjectSelection?: boolean;
  hasChanges?: boolean;
  message?: React.ReactNode;
  selected?: Set<number>;
};

const ProjectSelectorFooter = ({
  selected,
  disableMultipleProjectSelection,
  hasChanges,
  onApply,
  onShowAllProjects,
  onShowMyProjects,
  organization,
  message,
}: Props) => {
  // Nothing to show.
  if (disableMultipleProjectSelection && !hasChanges && !message) {
    return null;
  }

  // see if we should show "All Projects" or "My Projects" if disableMultipleProjectSelection isn't true
  const hasGlobalRole = organization.role === 'owner' || organization.role === 'manager';
  const hasOpenMembership = organization.features.includes('open-membership');
  const allSelected = selected && selected.has(ALL_ACCESS_PROJECTS);

  const canShowAllProjects = (hasGlobalRole || hasOpenMembership) && !allSelected;
  const onProjectClick = canShowAllProjects ? onShowAllProjects : onShowMyProjects;
  const buttonText = canShowAllProjects
    ? t('Select All Projects')
    : t('Select My Projects');

  const hasProjectWrite = organization.access.includes('project:write');
  const newProjectUrl = `/organizations/${organization.slug}/projects/new/`;

  return (
    <FooterContainer hasMessage={!!message}>
      {message && <FooterMessage>{message}</FooterMessage>}
      <FooterActions>
        <Button
          aria-label={t('Add Project')}
          disabled={!hasProjectWrite}
          to={newProjectUrl}
          size="xsmall"
          icon={<IconAdd size="xs" isCircled />}
          title={
            !hasProjectWrite ? t("You don't have permission to add a project") : undefined
          }
        >
          {t('Project')}
        </Button>
        {!disableMultipleProjectSelection && (
          <Feature
            features={['organizations:global-views']}
            organization={organization}
            hookName="feature-disabled:project-selector-all-projects"
            renderDisabled={false}
          >
            {({renderShowAllButton, hasFeature}: FeatureRenderProps) => {
              // if our hook is adding renderShowAllButton, render that
              if (renderShowAllButton) {
                return renderShowAllButton({
                  onButtonClick: onProjectClick,
                  canShowAllProjects,
                });
              }
              // if no hook, render null if feature is disabled
              if (!hasFeature) {
                return null;
              }
              // otherwise render the buton
              return (
                <Button priority="default" size="xsmall" onClick={onProjectClick}>
                  {buttonText}
                </Button>
              );
            }}
          </Feature>
        )}
        {hasChanges && (
          <SubmitButton onClick={onApply} size="xsmall" priority="primary">
            {t('Apply Filter')}
          </SubmitButton>
        )}
      </FooterActions>
    </FooterContainer>
  );
};

export default ProjectSelectorFooter;

const FooterContainer = styled('div')<{hasMessage: boolean}>`
  display: flex;
  justify-content: ${p => (p.hasMessage ? 'space-between' : 'flex-end')};
`;

const FooterActions = styled('div')`
  display: grid;
  grid-auto-flow: column dense;
  justify-items: end;
  padding: ${space(1)} 0;
  gap: ${space(1)};

  & > * {
    margin-left: ${space(0.5)};
  }
  &:empty {
    display: none;
  }
`;

const SubmitButton = styled(Button)`
  animation: 0.1s ${growIn} ease-in;
`;

const FooterMessage = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  padding: ${space(1)} ${space(0.5)};
`;
