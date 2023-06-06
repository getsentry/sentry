import {Fragment} from 'react';

import Feature from 'sentry/components/acl/feature';
import {Button} from 'sentry/components/button';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

interface FeatureRenderProps {
  hasFeature: boolean;
  renderShowAllButton?: (props: {
    canShowAllProjects: boolean;
    onButtonClick: () => void;
  }) => React.ReactNode;
}

interface ProjectPageFilterMenuFooterProps {
  handleChange: (value: number[]) => void;
  showNonMemberProjects: boolean;
}

function ProjectPageFilterMenuFooter({
  handleChange,
  showNonMemberProjects,
}: ProjectPageFilterMenuFooterProps) {
  const organization = useOrganization();

  return (
    <Fragment>
      <Feature
        organization={organization}
        features={['organizations:global-views']}
        hookName="feature-disabled:project-selector-all-projects"
        renderDisabled={false}
      >
        {({renderShowAllButton}: FeatureRenderProps) => {
          // if our hook is adding renderShowAllButton, render that
          if (showNonMemberProjects && renderShowAllButton) {
            return renderShowAllButton({
              onButtonClick: () => handleChange([]),
              canShowAllProjects: showNonMemberProjects,
            });
          }

          return null;
        }}
      </Feature>
      <Button
        size="xs"
        aria-label={t('Add Project')}
        to={`/organizations/${organization.slug}/projects/new/`}
        icon={<IconAdd size="xs" isCircled />}
      >
        {t('Project')}
      </Button>
    </Fragment>
  );
}

export {ProjectPageFilterMenuFooter};
