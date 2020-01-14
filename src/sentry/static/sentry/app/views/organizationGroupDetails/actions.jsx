import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';

import {analytics} from 'app/utils/analytics';
import {openModal} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import withApi from 'app/utils/withApi';
import Button from 'app/components/button';
import DropdownLink from 'app/components/dropdownLink';
import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import GroupActions from 'app/actions/groupActions';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import IgnoreActions from 'app/components/actions/ignore';
import IndicatorStore from 'app/stores/indicatorStore';
import LinkWithConfirmation from 'app/components/links/linkWithConfirmation';
import MenuItem from 'app/components/menuItem';
import ResolveActions from 'app/components/actions/resolve';
import SentryTypes from 'app/sentryTypes';
import ShareIssue from 'app/components/shareIssue';
import space from 'app/styles/space';
import {uniqueId} from 'app/utils/guid';
import withOrganization from 'app/utils/withOrganization';

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
        <GuideAnchor target="ignore_delete_discard" />
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

  onDelete() {
    const {group, project, organization} = this.props;
    const loadingIndicator = IndicatorStore.add(t('Delete event..'));

    this.props.api.bulkDelete(
      {
        orgId: organization.slug,
        projectId: project.slug,
        itemIds: [group.id],
      },
      {
        complete: () => {
          IndicatorStore.remove(loadingIndicator);

          browserHistory.push(`/${organization.slug}/${project.slug}/`);
        },
      }
    );
  },

  onUpdate(data) {
    const {group, project, organization} = this.props;
    const loadingIndicator = IndicatorStore.add(t('Saving changes..'));

    this.props.api.bulkUpdate(
      {
        orgId: organization.slug,
        projectId: project.slug,
        itemIds: [group.id],
        data,
      },
      {
        complete: () => {
          IndicatorStore.remove(loadingIndicator);
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
          IndicatorStore.add(t('Error sharing'), 'error');
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

  onDiscard() {
    const {group, project, organization} = this.props;
    const id = uniqueId();
    const loadingIndicator = IndicatorStore.add(t('Discarding event..'));

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
        IndicatorStore.remove(loadingIndicator);
      },
    });
  },

  render() {
    const {group, project, organization} = this.props;
    const orgFeatures = new Set(organization.features);

    let bookmarkClassName = 'group-bookmark btn btn-default btn-sm';
    if (group.isBookmarked) {
      bookmarkClassName += ' active';
    }

    const hasRelease = new Set(project.features).has('releases');

    const isResolved = group.status === 'resolved';
    const isIgnored = group.status === 'ignored';

    return (
      <div className="group-actions">
        <ResolveActions
          hasRelease={hasRelease}
          latestRelease={project.latestRelease}
          onUpdate={this.onUpdate}
          orgId={organization.slug}
          projectId={project.slug}
          isResolved={isResolved}
          isAutoResolved={isResolved && group.statusDetails.autoResolved}
        />
        <IgnoreActions isIgnored={isIgnored} onUpdate={this.onUpdate} />

        <div className="btn-group">
          <a
            className={bookmarkClassName}
            title={t('Bookmark')}
            onClick={this.onToggleBookmark}
          >
            <span className="icon-star-solid" />
          </a>
        </div>
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
      </div>
    );
  },
});

export {GroupDetailsActions};

export default withApi(withOrganization(GroupDetailsActions));
