import * as React from 'react';
import {css} from '@emotion/react';
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
import {alertHighlight, pulse} from 'sentry/styles/animations';
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

type State = {
  bookmarkHasChanged: boolean;
};

class ProjectSelectorItem extends React.PureComponent<Props, State> {
  static defaultProps = defaultProps;
  state: State = {
    bookmarkHasChanged: false,
  };

  componentDidUpdate(nextProps: Props) {
    if (nextProps.project.isBookmarked !== this.props.project.isBookmarked) {
      this.setBookmarkHasChanged();
    }
  }

  setBookmarkHasChanged() {
    this.setState({bookmarkHasChanged: true});
  }

  handleClick = (event: React.MouseEvent) => {
    const {project, onMultiSelect} = this.props;

    event.stopPropagation();

    if (onMultiSelect) {
      onMultiSelect(project, event);
    }
  };

  handleBookmarkToggle = (isBookmarked: boolean) => {
    const {organization} = this.props;
    analytics('projectselector.bookmark_toggle', {
      org_id: parseInt(organization.id, 10),
      bookmarked: isBookmarked,
    });
  };

  clearAnimation = () => {
    this.setState({bookmarkHasChanged: false});
  };

  renderDisabledCheckbox({
    children,
    features,
  }: {
    children: React.ReactNode;
    features: string[];
  }) {
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
  }

  render() {
    const {project, multi, inputValue, isChecked, organization} = this.props;
    const {bookmarkHasChanged} = this.state;

    return (
      <BadgeAndActionsWrapper
        bookmarkHasChanged={bookmarkHasChanged}
        onAnimationEnd={this.clearAnimation}
      >
        <PageFilterRow
          checked={isChecked}
          onCheckClick={this.handleClick}
          multi={multi}
          renderCheckbox={({checkbox}) => (
            <Feature
              features={['organizations:global-views']}
              hookName="feature-disabled:project-selector-checkbox"
              renderDisabled={this.renderDisabledCheckbox}
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
            bookmarkHasChanged={bookmarkHasChanged}
            onToggle={this.handleBookmarkToggle}
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
}

export default ProjectSelectorItem;

const StyledBookmarkStar = styled(BookmarkStar)<{bookmarkHasChanged: boolean}>`
  padding: ${space(1)} ${space(0.5)};
  box-sizing: content-box;
  opacity: ${p => (p.project.isBookmarked ? 1 : 0.33)};
  transition: 0.5s opacity ease-out;
  display: block;
  width: 14px;
  height: 14px;
  margin-top: -${space(0.25)}; /* trivial alignment bump */
  ${p =>
    p.bookmarkHasChanged &&
    css`
      animation: 0.5s ${pulse(1.4)};
    `};
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

const BadgeAndActionsWrapper = styled('div')<{bookmarkHasChanged: boolean}>`
  ${p =>
    p.bookmarkHasChanged &&
    css`
      animation: 1s ${alertHighlight('info', p.theme)};
    `};
  z-index: ${p => (p.bookmarkHasChanged ? 1 : 'inherit')};
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
