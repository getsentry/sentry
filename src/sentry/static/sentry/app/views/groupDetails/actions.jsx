import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';

import createReactClass from 'create-react-class';

import {t} from 'app/locale';
import ApiMixin from 'app/mixins/apiMixin';
import DropdownLink from 'app/components/dropdownLink';
import GroupActions from 'app/actions/groupActions';
import GroupState from 'app/mixins/groupState';
import ErrorBoundary from 'app/components/errorBoundary';
import ExternalIssueActions from 'app/components/group/externalIssues';
import HookStore from 'app/stores/hookStore';
import IndicatorStore from 'app/stores/indicatorStore';
import IssuePluginActions from 'app/components/group/issuePluginActions';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import LinkWithConfirmation from 'app/components/linkWithConfirmation';
import MenuItem from 'app/components/menuItem';
import ShareIssue from 'app/components/shareIssue';

import ResolveActions from 'app/components/actions/resolve';
import IgnoreActions from 'app/components/actions/ignore';

class DeleteActions extends React.Component {
  static propTypes = {
    organization: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
    onDelete: PropTypes.func.isRequired,
    onDiscard: PropTypes.func.isRequired,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      hooksDisabled: HookStore.get('project:discard-groups:disabled'),
    };
  }

  renderDisabledDiscard = () => {
    let {project, organization} = this.props;
    return this.state.hooksDisabled.map(hook => hook(organization, project));
  };

  renderDiscard = () => {
    return (
      <DropdownLink caret={true} className="group-delete btn btn-default btn-sm">
        <li>
          <LinkWithConfirmation
            title={t('Discard')}
            message={t(
              'Discarding this event will result in the deletion ' +
                'of most data associated with this issue and future ' +
                'events being discarded before reaching your stream. ' +
                'Are you sure you wish to continue?'
            )}
            onConfirm={this.props.onDiscard}
          >
            <GuideAnchor type="text" target="delete_discard" />
            <span>{t('Delete and discard future events')}</span>
          </LinkWithConfirmation>
        </li>
      </DropdownLink>
    );
  };

  render() {
    let features = new Set(this.props.project.features);
    let hasDiscard = features.has('discard-groups');

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
        {hasDiscard ? this.renderDiscard() : this.renderDisabledDiscard()}
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

    // account for both old and new style plugins
    let hasIssueTracking = group.pluginActions.length || group.pluginIssues.length;

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
          project={project}
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

        {group.pluginActions.length > 1 ? (
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
          group.pluginIssues.map(plugin => {
            return <IssuePluginActions key={plugin.slug} plugin={plugin} />;
          })}
        {!hasIssueTracking && (
          <GuideAnchor type="text" target="issue_tracking">
            <a
              href={`/${this.getOrganization().slug}/${this.getProject()
                .slug}/settings/issue-tracking/`}
              className={'btn btn-default btn-sm btn-config-issue-tracking'}
              style={{marginRight: '5px'}}
            >
              {t('Link Issue Tracker')}
            </a>
          </GuideAnchor>
        )}
        {orgFeatures.has('internal-catchall') && (
          <ErrorBoundary mini>
            <ExternalIssueActions group={group} />
          </ErrorBoundary>
        )}
      </div>
    );
  },
});

export default GroupDetailsActions;
