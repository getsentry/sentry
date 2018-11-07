import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';

import FeatureDisabled from 'app/components/acl/featureDisabled';
import {openModal} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import ApiMixin from 'app/mixins/apiMixin';
import Button from 'app/components/button';
import DropdownLink from 'app/components/dropdownLink';
import Feature from 'app/components/acl/feature';
import GroupActions from 'app/actions/groupActions';
import GroupState from 'app/mixins/groupState';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import HookStore from 'app/stores/hookStore';
import IgnoreActions from 'app/components/actions/ignore';
import IndicatorStore from 'app/stores/indicatorStore';
import IssuePluginActions from 'app/components/group/issuePluginActions';
import LinkWithConfirmation from 'app/components/linkWithConfirmation';
import MenuItem from 'app/components/menuItem';
import ResolveActions from 'app/components/actions/resolve';
import ShareIssue from 'app/components/shareIssue';
import space from 'app/styles/space';

class DeleteActions extends React.Component {
  static propTypes = {
    organization: PropTypes.object.isRequired,
    onDelete: PropTypes.func.isRequired,
    onDiscard: PropTypes.func.isRequired,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      hooksDisabled: HookStore.get('project:discard-groups:disabled'),
    };
  }

  renderDiscardDisabled = ({children, ...props}) =>
    children({
      ...props,
      renderDisabled: ({features}) => (
        <FeatureDisabled alert featureName="Discard and Delete" feature={features[0]} />
      ),
    });

  renderDiscardModal = ({Body, closeModal}) => (
    <Feature
      features={['discard-groups']}
      organization={this.props.organization}
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

  openDiscardModal = () => openModal(this.renderDiscardModal);

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
          <GuideAnchor type="text" target="ignore_delete_discard" />
        </LinkWithConfirmation>
        <DropdownLink caret={true} className="group-delete btn btn-default btn-sm">
          <MenuItem onClick={this.openDiscardModal}>
            <GuideAnchor type="text" target="delete_discard" />
            <span>{t('Delete and discard future events')}</span>
          </MenuItem>
        </DropdownLink>
      </div>
    );
  }
}

const GroupDetailsActions = createReactClass({
  displayName: 'GroupDetailsActions',

  mixins: [ApiMixin, GroupState],

  getInitialState() {
    return {ignoreModal: null, shareBusy: false};
  },

  getShareUrl(shareId, absolute) {
    if (!shareId) return '';

    let path = `/share/issue/${shareId}/`;
    if (!absolute) {
      return path;
    }
    let {host, protocol} = window.location;
    return `${protocol}//${host}${path}`;
  },

  onDelete() {
    let group = this.getGroup();
    let project = this.getProject();
    let org = this.getOrganization();
    let loadingIndicator = IndicatorStore.add(t('Delete event..'));

    this.api.bulkDelete(
      {
        orgId: org.slug,
        projectId: project.slug,
        itemIds: [group.id],
      },
      {
        complete: () => {
          IndicatorStore.remove(loadingIndicator);

          browserHistory.push(`/${org.slug}/${project.slug}/`);
        },
      }
    );
  },

  onUpdate(data) {
    let group = this.getGroup();
    let project = this.getProject();
    let org = this.getOrganization();
    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));

    this.api.bulkUpdate(
      {
        orgId: org.slug,
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
    let group = this.getGroup();
    let project = this.getProject();
    let org = this.getOrganization();
    this.setState({shareBusy: true});

    // not sure why this is a bulkUpdate
    this.api.bulkUpdate(
      {
        orgId: org.slug,
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
    let group = this.getGroup();
    this.onShare(!group.isPublic);
  },

  onToggleBookmark() {
    this.onUpdate({isBookmarked: !this.getGroup().isBookmarked});
  },

  onDiscard() {
    let group = this.getGroup();
    let project = this.getProject();
    let org = this.getOrganization();
    let id = this.api.uniqueId();
    let loadingIndicator = IndicatorStore.add(t('Discarding event..'));

    GroupActions.discard(id, group.id);

    this.api.request(`/issues/${group.id}/`, {
      method: 'PUT',
      data: {discard: true},
      success: response => {
        GroupActions.discardSuccess(id, group.id, response);
        browserHistory.push(`/${org.slug}/${project.slug}/`);
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
    let group = this.getGroup();
    let project = this.getProject();
    let org = this.getOrganization();
    let orgFeatures = new Set(this.getOrganization().features);

    let bookmarkClassName = 'group-bookmark btn btn-default btn-sm';
    if (group.isBookmarked) {
      bookmarkClassName += ' active';
    }

    let hasRelease = this.getProjectFeatures().has('releases');

    let isResolved = group.status === 'resolved';
    let isIgnored = group.status === 'ignored';

    return (
      <div className="group-actions">
        <ResolveActions
          hasRelease={hasRelease}
          latestRelease={project.latestRelease}
          onUpdate={this.onUpdate}
          orgId={org.slug}
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
          organization={org}
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

        {group.pluginActions.length > 1 && !orgFeatures.has('new-issue-ui') ? (
          <div className="btn-group more">
            <DropdownLink className="btn btn-default btn-sm" title={t('More')}>
              {group.pluginActions.map((action, actionIdx) => {
                return (
                  <MenuItem key={actionIdx} href={action[1]}>
                    {action[0]}
                  </MenuItem>
                );
              })}
            </DropdownLink>
          </div>
        ) : (
          group.pluginActions.length !== 0 &&
          !orgFeatures.has('new-issue-ui') &&
          group.pluginActions.map((action, actionIdx) => {
            return (
              <div className="btn-group" key={actionIdx}>
                <a className="btn btn-default btn-sm" href={action[1]}>
                  {action[0]}
                </a>
              </div>
            );
          })
        )}
        {group.pluginIssues &&
          !orgFeatures.has('new-issue-ui') &&
          group.pluginIssues.map(plugin => {
            return <IssuePluginActions key={plugin.slug} plugin={plugin} />;
          })}
      </div>
    );
  },
});

export default GroupDetailsActions;
