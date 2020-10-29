import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'app/actionCreators/indicator';
import {analytics} from 'app/utils/analytics';
import {openModal} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import {uniqueId} from 'app/utils/guid';
import Button from 'app/components/button';
import DropdownLink from 'app/components/dropdownLink';
import EventView from 'app/utils/discover/eventView';
import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import GroupActions from 'app/actions/groupActions';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import IgnoreActions from 'app/components/actions/ignore';
import {IconDelete, IconStar, IconRefresh} from 'app/icons';
import Link from 'app/components/links/link';
import LinkWithConfirmation from 'app/components/links/linkWithConfirmation';
import MenuItem from 'app/components/menuItem';
import ReprocessingForm from 'app/views/organizationGroupDetails/reprocessingForm';
import ResolveActions from 'app/components/actions/resolve';
import SentryTypes from 'app/sentryTypes';
import ShareIssue from 'app/components/shareIssue';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

import SubscribeAction from './subscribeAction';

class DeleteActions extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    project: SentryTypes.Project.isRequired,
    onDelete: PropTypes.func.isRequired,
    onDiscard: PropTypes.func.isRequired,
  };

  renderDiscardDisabled = ({children, ...props}) =>
    children({
      ...props,
      renderDisabled: ({features}) => (
        <FeatureDisabled alert featureName="Discard and Delete" features={features} />
      ),
    });

  renderDiscardModal = ({Body, closeModal}) => (
    <Feature
      features={['projects:discard-groups']}
      hookName="feature-disabled:discard-groups"
      organization={this.props.organization}
      project={this.props.project}
      renderDisabled={this.renderDiscardDisabled}
    >
      {({hasFeature, renderDisabled, ...props}) => (
        <React.Fragment>
          <Body>
            {!hasFeature && renderDisabled({hasFeature, ...props})}
            {t(
              'Discarding this event will result in the deletion ' +
                'of most data associated with this issue and future ' +
                'events being discarded before reaching your stream. ' +
                'Are you sure you wish to continue?'
            )}
          </Body>
          <div className="modal-footer">
            <Button onClick={closeModal}>{t('Cancel')}</Button>
            <Button
              style={{marginLeft: space(1)}}
              priority="primary"
              onClick={this.props.onDiscard}
              disabled={!hasFeature}
            >
              {t('Discard Future Events')}
            </Button>
          </div>
        </React.Fragment>
      )}
    </Feature>
  );

  openDiscardModal = () => {
    openModal(this.renderDiscardModal);
    analytics('feature.discard_group.modal_opened', {
      org_id: parseInt(this.props.organization.id, 10),
    });
  };

  render() {
    return (
      <div className="btn-group">
        <LinkWithConfirmation
          className="group-remove btn btn-default btn-sm"
          title={t('Delete')}
          message={t(
            'Deleting this issue is permanent. Are you sure you wish to continue?'
          )}
          onConfirm={this.props.onDelete}
        >
          <IconWrapper>
            <IconDelete size="xs" />
          </IconWrapper>
        </LinkWithConfirmation>
        <DropdownLink caret className="group-delete btn btn-default btn-sm">
          <MenuItem onClick={this.openDiscardModal}>
            <span>{t('Delete and discard future events')}</span>
          </MenuItem>
        </DropdownLink>
      </div>
    );
  }
}

const GroupDetailsActions = createReactClass({
  displayName: 'GroupDetailsActions',

  propTypes: {
    api: PropTypes.object.isRequired,
    group: SentryTypes.Group.isRequired,
    project: SentryTypes.Project.isRequired,
    organization: SentryTypes.Organization.isRequired,
  },

  getInitialState() {
    return {ignoreModal: null, shareBusy: false};
  },

  componentWillReceiveProps(nextProps) {
    if (this.state.shareBusy && nextProps.group.shareId !== this.props.group.shareId) {
      this.setState({shareBusy: false});
    }
  },

  getShareUrl(shareId) {
    if (!shareId) {
      return '';
    }

    const path = `/share/issue/${shareId}/`;
    const {host, protocol} = window.location;
    return `${protocol}//${host}${path}`;
  },

  getDiscoverUrl() {
    const {group, project, organization} = this.props;

    const discoverQuery = {
      id: undefined,
      name: group.title || group.type,
      fields: ['title', 'release', 'environment', 'user', 'timestamp'],
      orderby: '-timestamp',
      query: `issue.id:${group.id}`,
      projects: [project.id],
      version: 2,
      range: '90d',
    };

    const discoverView = EventView.fromSavedQuery(discoverQuery);
    return discoverView.getResultsViewUrlTarget(organization.slug);
  },

  onDelete() {
    const {group, project, organization} = this.props;
    addLoadingMessage(t('Delete event\u2026'));

    this.props.api.bulkDelete(
      {
        orgId: organization.slug,
        projectId: project.slug,
        itemIds: [group.id],
      },
      {
        complete: () => {
          clearIndicators();

          browserHistory.push(`/${organization.slug}/${project.slug}/`);
        },
      }
    );
  },

  onUpdate(data) {
    const {group, project, organization} = this.props;
    addLoadingMessage(t('Saving changes\u2026'));

    this.props.api.bulkUpdate(
      {
        orgId: organization.slug,
        projectId: project.slug,
        itemIds: [group.id],
        data,
      },
      {
        complete: () => {
          clearIndicators();
        },
      }
    );
  },

  onReprocess() {
    const {group, organization} = this.props;
    openModal(props => (
      <ReprocessingForm group={group} organization={organization} {...props} />
    ));
  },

  onShare(shared) {
    const {group, project, organization} = this.props;
    this.setState({shareBusy: true});

    // not sure why this is a bulkUpdate
    this.props.api.bulkUpdate(
      {
        orgId: organization.slug,
        projectId: project.slug,
        itemIds: [group.id],
        data: {
          isPublic: shared,
        },
      },
      {
        error: () => {
          addErrorMessage(t('Error sharing'));
        },
        complete: () => {
          // shareBusy marked false in componentWillReceiveProps to sync
          // busy state update with shareId update
        },
      }
    );
  },

  onToggleShare() {
    this.onShare(!this.props.group.isPublic);
  },

  onToggleBookmark() {
    this.onUpdate({isBookmarked: !this.props.group.isBookmarked});
  },

  onToggleSubscribe() {
    this.onUpdate({isSubscribed: !this.props.group.isSubscribed});
  },

  onDiscard() {
    const {group, project, organization} = this.props;
    const id = uniqueId();
    addLoadingMessage(t('Discarding event\u2026'));

    GroupActions.discard(id, group.id);

    this.props.api.request(`/issues/${group.id}/`, {
      method: 'PUT',
      data: {discard: true},
      success: response => {
        GroupActions.discardSuccess(id, group.id, response);
        browserHistory.push(`/${organization.slug}/${project.slug}/`);
      },
      error: error => {
        GroupActions.discardError(id, group.id, error);
      },
      complete: () => {
        clearIndicators();
      },
    });
  },

  render() {
    const {group, project, organization} = this.props;
    const orgFeatures = new Set(organization.features);
    const projectFeatures = new Set(project.features);

    const buttonClassName = 'btn btn-default btn-sm';
    let bookmarkClassName = `group-bookmark ${buttonClassName}`;
    if (group.isBookmarked) {
      bookmarkClassName += ' active';
    }

    const hasRelease = new Set(project.features).has('releases');

    const isResolved = group.status === 'resolved';
    const isIgnored = group.status === 'ignored';

    return (
      <div className="group-actions">
        <GuideAnchor target="resolve" position="bottom" offset={space(3)}>
          <ResolveActions
            hasRelease={hasRelease}
            latestRelease={project.latestRelease}
            onUpdate={this.onUpdate}
            orgId={organization.slug}
            projectId={project.slug}
            isResolved={isResolved}
            isAutoResolved={isResolved && group.statusDetails.autoResolved}
          />
        </GuideAnchor>
        <GuideAnchor target="ignore_delete_discard" position="bottom" offset={space(3)}>
          <IgnoreActions isIgnored={isIgnored} onUpdate={this.onUpdate} />
        </GuideAnchor>
        <DeleteActions
          organization={organization}
          project={project}
          onDelete={this.onDelete}
          onDiscard={this.onDiscard}
        />
        {projectFeatures.has('reprocessing-v2') && (
          <div className="btn-group">
            <Tooltip title={t('Reprocess this issue')}>
              <div className={buttonClassName} onClick={this.onReprocess}>
                <IconWrapper>
                  <IconRefresh size="xs" />
                </IconWrapper>
              </div>
            </Tooltip>
          </div>
        )}
        {orgFeatures.has('shared-issues') && (
          <div className="btn-group">
            <ShareIssue
              loading={this.state.shareBusy}
              isShared={group.isPublic}
              shareUrl={this.getShareUrl(group.shareId)}
              onToggle={this.onToggleShare}
              onReshare={() => this.onShare(true)}
            />
          </div>
        )}
        {orgFeatures.has('discover-basic') && (
          <div className="btn-group">
            <Link
              className={buttonClassName}
              title={t('Open in Discover')}
              to={this.getDiscoverUrl()}
            >
              {t('Open in Discover')}
            </Link>
          </div>
        )}
        <div className="btn-group">
          <div
            className={bookmarkClassName}
            title={t('Bookmark')}
            onClick={this.onToggleBookmark}
          >
            <IconWrapper>
              <IconStar isSolid size="xs" />
            </IconWrapper>
          </div>
        </div>
        <SubscribeAction group={group} onClick={this.onToggleSubscribe} />
      </div>
    );
  },
});

const IconWrapper = styled('span')`
  position: relative;
  top: 1px;
`;

export {GroupDetailsActions};

export default withApi(withOrganization(GroupDetailsActions));
