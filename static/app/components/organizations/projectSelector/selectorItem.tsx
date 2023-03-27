import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {Button} from 'sentry/components/button';
import Highlight from 'sentry/components/highlight';
import {Hovercard} from 'sentry/components/hovercard';
import IdBadge from 'sentry/components/idBadge';
import PageFilterRow from 'sentry/components/organizations/pageFilterRow';
import BookmarkStar from 'sentry/components/projects/bookmarkStar';
import {IconOpen, IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {analytics} from 'sentry/utils/analytics';

type Props = {
  inputValue: string;
  isChecked: boolean;
  multi: boolean;
  organization: Organization;
  project: Project;
  onMultiSelect?: (project: Project) => void;
};

function ProjectSelectorItem({
  project,
  organization,
  onMultiSelect,
  multi = false,
  inputValue = '',
  isChecked = false,
}: Props) {
  const onSelectedChange = () => {
    onMultiSelect?.(project);
  };

  const handleBookmarkToggle = (isBookmarked: boolean) => {
    analytics('projectselector.bookmark_toggle', {
      org_id: parseInt(organization.id, 10),
      bookmarked: isBookmarked,
    });
  };

  const renderDisabledCheckbox = ({
    children,
    features,
  }: {
    children: React.ReactNode;
    features: string[];
  }) => {
    return (
      <Hovercard
        body={
          <FeatureDisabled
            features={features}
            hideHelpToggle
            featureName={t('Multiple Project Selection')}
          />
        }
      >
        {children}
      </Hovercard>
    );
  };

  return (
    <ProjectFilterRow
      checked={isChecked}
      onSelectedChange={onSelectedChange}
      multi={multi}
      renderCheckbox={({checkbox}) => (
        <Feature
          features={['organizations:global-views']}
          hookName="feature-disabled:project-selector-checkbox"
          renderDisabled={renderDisabledCheckbox}
        >
          {checkbox}
        </Feature>
      )}
    >
      <BadgeWrapper>
        <IdBadge
          project={project}
          avatarSize={16}
          displayName={<Highlight text={inputValue}>{project.slug}</Highlight>}
          avatarProps={{consistentWidth: true}}
          disableLink
        />
      </BadgeWrapper>
      <ActionBookmark
        project={project}
        organization={organization}
        onToggle={handleBookmarkToggle}
      />
      <ActionButton
        to={`/organizations/${organization.slug}/projects/${project.slug}/?project=${project.id}`}
        size="zero"
        priority="link"
        aria-label="Project Details"
        icon={<IconOpen />}
      />
      <ActionButton
        to={`/settings/${organization.slug}/projects/${project.slug}/`}
        size="zero"
        priority="link"
        aria-label="Project Settings"
        icon={<IconSettings />}
      />
    </ProjectFilterRow>
  );
}

export default ProjectSelectorItem;

const BadgeWrapper = styled('div')`
  display: flex;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
`;

const ActionButton = styled(Button)`
  color: ${p => p.theme.subText};
  padding: ${space(1)} ${space(0.25)} ${space(1)} ${space(1)};
  opacity: 0.33;
  :hover {
    color: ${p => p.theme.textColor};
  }
`;

const ActionBookmark = styled(BookmarkStar)`
  ${p => !p.project.isBookmarked && 'opacity: 0.33'};
`;

const ProjectFilterRow = styled(PageFilterRow)`
  :hover ${ActionButton}, :hover ${ActionBookmark} {
    opacity: 1;
  }
`;
