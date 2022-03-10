import * as React from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import Highlight from 'sentry/components/highlight';
import {Hovercard} from 'sentry/components/hovercard';
import IdBadge from 'sentry/components/idBadge';
import Link from 'sentry/components/links/link';
import PageFilterRow from 'sentry/components/organizations/pageFilterRow';
import BookmarkStar from 'sentry/components/projects/bookmarkStar';
import {IconOpen, IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {analytics} from 'sentry/utils/analytics';

const defaultProps = {
  multi: false,
  inputValue: '',
  isChecked: false,
};

type Props = {
  organization: Organization;
  project: Project;
  onMultiSelect?: (project: Project, event: React.MouseEvent) => void;
} & typeof defaultProps;

function ProjectSelectorItem({
  project,
  organization,
  onMultiSelect,
  multi = false,
  inputValue = '',
  isChecked = false,
}: Props) {
  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    onMultiSelect?.(project, event);
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
            message={t('Multiple project selection disabled')}
            featureName={t('Multiple Project Selection')}
          />
        }
      >
        {children}
      </Hovercard>
    );
  };

  return (
    <BadgeAndActionsWrapper>
      <PageFilterRow
        checked={isChecked}
        onCheckClick={handleClick}
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
        <BadgeWrapper isMulti={multi}>
          <IdBadge
            project={project}
            avatarSize={16}
            displayName={<Highlight text={inputValue}>{project.slug}</Highlight>}
            avatarProps={{consistentWidth: true}}
            disableLink
          />
        </BadgeWrapper>
        <StyledBookmarkStar
          project={project}
          organization={organization}
          onToggle={handleBookmarkToggle}
        />
        <StyledLink
          to={`/organizations/${organization.slug}/projects/${project.slug}/?project=${project.id}`}
          onClick={e => e.stopPropagation()}
        >
          <IconOpen />
        </StyledLink>

        <StyledLink
          to={`/settings/${organization.slug}/${project.slug}/`}
          onClick={e => e.stopPropagation()}
        >
          <IconSettings />
        </StyledLink>
      </PageFilterRow>
    </BadgeAndActionsWrapper>
  );
}

export default ProjectSelectorItem;

const StyledBookmarkStar = styled(BookmarkStar)`
  padding: ${space(1)} ${space(0.5)};
  box-sizing: content-box;
  opacity: ${p => (p.project.isBookmarked ? 1 : 0.33)};
  transition: 0.5s opacity ease-out;
  display: block;
  width: 14px;
  height: 14px;
  margin-top: -${space(0.25)}; /* trivial alignment bump */
`;

const BadgeWrapper = styled('div')<{isMulti: boolean}>`
  display: flex;
  flex: 1;
  ${p => !p.isMulti && 'flex: 1'};
  white-space: nowrap;
  overflow: hidden;
`;

const StyledLink = styled(Link)`
  color: ${p => p.theme.gray300};
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(1)} ${space(0.25)} ${space(1)} ${space(1)};
  opacity: 0.33;
  transition: 0.5s opacity ease-out;
  :hover {
    color: ${p => p.theme.textColor};
  }
`;

const BadgeAndActionsWrapper = styled('div')`
  position: relative;
  border-style: solid;
  border-width: 1px 0;
  border-color: transparent;
  :hover {
    ${StyledBookmarkStar} {
      opacity: 1;
    }
    ${StyledLink} {
      opacity: 1;
    }
  }
`;
