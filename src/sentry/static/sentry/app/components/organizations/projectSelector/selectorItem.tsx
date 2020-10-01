import React from 'react';
import styled from '@emotion/styled';
import {css} from '@emotion/core';

import {t} from 'app/locale';
import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import {Project, Organization} from 'app/types';
import {analytics} from 'app/utils/analytics';
import {alertHighlight, pulse} from 'app/styles/animations';
import BookmarkStar from 'app/components/projects/bookmarkStar';
import GlobalSelectionHeaderRow from 'app/components/globalSelectionHeaderRow';
import Highlight from 'app/components/highlight';
import IdBadge from 'app/components/idBadge';
import space from 'app/styles/space';
import {IconSettings} from 'app/icons';
import Link from 'app/components/links/link';
import Hovercard from 'app/components/hovercard';

const defaultProps = {
  multi: false,
  inputValue: '',
  isChecked: false,
};

type Props = {
  project: Project;
  organization: Organization;
  onMultiSelect?: (project: Project, event: React.MouseEvent) => void;
} & typeof defaultProps;

type State = {
  bookmarkHasChanged: boolean;
};

class ProjectSelectorItem extends React.PureComponent<Props, State> {
  static defaultProps = defaultProps;
  state: State = {
    bookmarkHasChanged: true,
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
        <GlobalSelectionHeaderRow
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
            />
          </BadgeWrapper>
          <StyledBookmarkStar
            project={project}
            organization={organization}
            bookmarkHasChanged={bookmarkHasChanged}
            onToggle={this.handleBookmarkToggle}
          />
          <StyledLink
            to={`/settings/${organization.slug}/${project.slug}/`}
            onClick={e => e.stopPropagation()}
          >
            <IconSettings />
          </StyledLink>
        </GlobalSelectionHeaderRow>
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
  color: ${p => p.theme.gray500};
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(1)} ${space(0.25)} ${space(1)} ${space(1)};
  opacity: 0.33;
  transition: 0.5s opacity ease-out;
  :hover {
    color: ${p => p.theme.gray700};
  }
`;

const BadgeAndActionsWrapper = styled('div')<{bookmarkHasChanged: boolean}>`
  ${p =>
    p.bookmarkHasChanged &&
    css`
      animation: 1s ${alertHighlight('info')};
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
