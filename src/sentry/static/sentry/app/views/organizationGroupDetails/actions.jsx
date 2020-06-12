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
import {t, tct} from 'app/locale';
import {uniqueId} from 'app/utils/guid';
import Button from 'app/components/button';
import DropdownLink from 'app/components/dropdownLink';
import EventView from 'app/utils/discover/eventView';
import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import GroupActions from 'app/actions/groupActions';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import IgnoreActions from 'app/components/actions/ignore';
import Link from 'app/components/links/link';
import LinkWithConfirmation from 'app/components/links/linkWithConfirmation';
import MenuItem from 'app/components/menuItem';
import ResolveActions from 'app/components/actions/resolve';
import SentryTypes from 'app/sentryTypes';
import ShareIssue from 'app/components/shareIssue';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import Tooltip from 'app/components/tooltip';
import {IconBell} from 'app/icons/iconBell';

const SUBSCRIPTION_REASONS = {
  commented: t(
    "You're receiving workflow notifications because you have commented on this issue."
  ),
  assigned: t(
    "You're receiving workflow notifications because you were assigned to this issue."
  ),
  bookmarked: t(
    "You're receiving workflow notifications because you have bookmarked this issue."
  ),
  changed_status: t(
    "You're receiving workflow notifications because you have changed the status of this issue."
  ),
  mentioned: t(
    "You're receiving workflow notifications because you have been mentioned in this issue."
  ),
};

class SubscribeAction extends React.Component {
  static propTypes = {
    group: SentryTypes.Group.isRequired,
    onToggleSubscribe: PropTypes.func.isRequired,
  };

  getNotificationText() {
    const {group} = this.props;

    if (group.isSubscribed) {
      let result = t(
        "You're receiving updates because you are subscribed to this issue."
      );
      if (group.subscriptionDetails) {
        const reason = group.subscriptionDetails.reason;
        if (SUBSCRIPTION_REASONS.hasOwnProperty(reason)) {
          result = SUBSCRIPTION_REASONS[reason];
        }
      } else {
        result = tct(
          "You're receiving updates because you are [link:subscribed to workflow notifications] for this project.",
          {
            link: <a href="/account/settings/notifications/" />,
          }
        );
      }
      return result;
    } else {
      if (group.subscriptionDetails && group.subscriptionDetails.disabled) {
        return tct('You have [link:disabled workflow notifications] for this project.', {
          link: <a href="/account/settings/notifications/" />,
        });
      } else {
        return t('Subscribe to receive workflow notifications for this issue');
      }
    }
  }

  render() {
    const {group, onToggleSubscribe} = this.props;
    const {isSubscribed} = group;

    let subscribedClassName = `group-subscribe btn btn-default btn-sm`;
    if (isSubscribed) {
      subscribedClassName += ' active';
    }

    return (
      <div className="btn-group">
        <Tooltip title={this.getNotificationText()}>
          <div
            className={subscribedClassName}
            title={t('Subscribe')}
            onClick={onToggleSubscribe}
          >
            <StyledIconBell size="xs" />
          </div>
        </Tooltip>
      </div>
    );
  }
}

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
          <span className="icon-trash" />
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

  getShareUrl(shareId, absolute) {
    if (!shareId) {
      return '';
    }

    const path = `/share/issue/${shareId}/`;
    if (!absolute) {
      return path;
    }
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
    addLoadingMessage(t('Delete event..'));

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
    addLoadingMessage(t('Saving changes..'));

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
          this.setState({shareBusy: false});
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
    addLoadingMessage(t('Discarding event..'));

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
        {orgFeatures.has('shared-issues') && (
          <div className="btn-group">
            <ShareIssue
              shareUrl={this.getShareUrl(group.shareId, true)}
              isSharing={group.isPublic}
              group={group}
              onToggle={this.onToggleShare}
              onShare={() => this.onShare(true)}
              busy={this.state.shareBusy}
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
            <span className="icon-star-solid" />
          </div>
        </div>
        <SubscribeAction group={group} onToggleSubscribe={this.onToggleSubscribe} />
      </div>
    );
  },
});

export {GroupDetailsActions};

export default withApi(withOrganization(GroupDetailsActions));

// Match the styles of bootstrap .btn.icon
const StyledIconBell = styled(IconBell)`
  position: relative;
  top: 2px;
  margin-right: -1px;
`;
