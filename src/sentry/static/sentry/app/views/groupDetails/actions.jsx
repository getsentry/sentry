import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';

import {getShortVersion} from '../../utils';
import {t} from '../../locale';
import ApiMixin from '../../mixins/apiMixin';
import CustomIgnoreCountModal from '../../components/customIgnoreCountModal';
import CustomIgnoreDurationModal from '../../components/customIgnoreDurationModal';
import CustomResolutionModal from '../../components/customResolutionModal';
import DropdownLink from '../../components/dropdownLink';
import Duration from '../../components/duration';
import GroupActions from '../../actions/groupActions';
import GroupState from '../../mixins/groupState';
import HookStore from '../../stores/hookStore';
import IndicatorStore from '../../stores/indicatorStore';
import IssuePluginActions from '../../components/group/issuePluginActions';
import LinkWithConfirmation from '../../components/linkWithConfirmation';
import MenuItem from '../../components/menuItem';
import ShareIssue from '../../components/shareIssue';
import TooltipMixin from '../../mixins/tooltip';

const ResolveActions = React.createClass({
  propTypes: {
    group: PropTypes.object.isRequired,
    hasRelease: PropTypes.bool.isRequired,
    latestRelease: PropTypes.object,
    onUpdate: PropTypes.func.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
  },

  getInitialState() {
    return {
      modal: false,
    };
  },

  onCustomResolution(statusDetails) {
    this.setState({
      modal: false,
    });
    this.props.onUpdate({
      status: 'resolved',
      statusDetails,
    });
  },

  render() {
    let {group, hasRelease, latestRelease, onUpdate} = this.props;
    let resolveClassName = 'group-resolve btn btn-default btn-sm';
    if (group.status === 'resolved') {
      resolveClassName += ' active';
    }

    if (group.status === 'resolved' && group.statusDetails.autoResolved) {
      return (
        <div className="btn-group">
          <a
            className={resolveClassName + ' tip'}
            title={t(
              'This event is resolved due to the Auto Resolve configuration for this project'
            )}
          >
            <span className="icon-checkmark" />
          </a>
        </div>
      );
    } else if (group.status === 'resolved') {
      return (
        <div className="btn-group">
          <a
            className={resolveClassName}
            title={t('Unresolve')}
            onClick={() => onUpdate({status: 'unresolved'})}
          >
            <span className="icon-checkmark" />
          </a>
        </div>
      );
    }

    let actionClassName = `tip ${!hasRelease ? 'disabled' : ''}`;
    let actionTitle = !hasRelease
      ? t('Set up release tracking in order to use this feature.')
      : '';

    return (
      <div style={{display: 'inline-block'}}>
        <CustomResolutionModal
          show={this.state.modal}
          onSelected={this.onCustomResolution}
          onCanceled={() => this.setState({modal: false})}
          orgId={this.props.orgId}
          projectId={this.props.projectId}
        />
        <div className="btn-group">
          <a
            key="resolve-button"
            className={resolveClassName}
            title={t('Resolve')}
            onClick={() => onUpdate({status: 'resolved'})}
          >
            <span className="icon-checkmark" style={{marginRight: 5}} />
            {t('Resolve')}
          </a>
          <DropdownLink
            key="resolve-dropdown"
            caret={true}
            className={resolveClassName}
            title=""
          >
            <MenuItem header={true}>{t('Resolved In')}</MenuItem>
            <MenuItem noAnchor={true}>
              <a
                onClick={() => {
                  return (
                    hasRelease &&
                    onUpdate({
                      status: 'resolved',
                      statusDetails: {
                        inNextRelease: true,
                      },
                    })
                  );
                }}
                className={actionClassName}
                title={actionTitle}
              >
                {t('The next release')}
              </a>
              <a
                onClick={() => {
                  return (
                    hasRelease &&
                    onUpdate({
                      status: 'resolved',
                      statusDetails: {
                        inRelease: latestRelease ? latestRelease.version : 'latest',
                      },
                    })
                  );
                }}
                className={actionClassName}
                title={actionTitle}
              >
                {latestRelease
                  ? t('The current release (%s)', getShortVersion(latestRelease.version))
                  : t('The current release')}
              </a>
              <a
                onClick={() => hasRelease && this.setState({modal: true})}
                className={actionClassName}
                title={actionTitle}
              >
                {t('Another version ...')}
              </a>
            </MenuItem>
          </DropdownLink>
        </div>
      </div>
    );
  },
});

const IgnoreActions = React.createClass({
  propTypes: {
    group: PropTypes.object.isRequired,
    onUpdate: PropTypes.func.isRequired,
  },

  getInitialState() {
    return {
      modal: false,
    };
  },

  getIgnoreDurations() {
    return [30, 120, 360, 60 * 24, 60 * 24 * 7];
  },

  getIgnoreCounts() {
    return [100, 1000, 10000, 100000];
  },

  getIgnoreWindows() {
    return [[60, 'per hour'], [24 * 60, 'per day'], [24 * 7 * 60, 'per week']];
  },

  onCustomIgnore(statusDetails) {
    this.setState({
      modal: false,
    });
    this.onIgnore(statusDetails);
  },

  onIgnore(statusDetails) {
    return this.props.onUpdate({
      status: 'ignored',
      statusDetails: statusDetails || {},
    });
  },

  render() {
    let {group, onUpdate} = this.props;
    let linkClassName = 'group-ignore btn btn-default btn-sm';
    if (group.status === 'ignored') {
      linkClassName += ' active';
    }

    if (group.status === 'ignored') {
      return (
        <div className="btn-group">
          <a
            className={linkClassName + ' tip'}
            title={t('Change status to unresolved')}
            onClick={() => onUpdate({status: 'unresolved'})}
          >
            <span className="icon-ban" />
          </a>
        </div>
      );
    }

    return (
      <div style={{display: 'inline-block'}}>
        <CustomIgnoreDurationModal
          show={this.state.modal === 'duration'}
          onSelected={this.onCustomIgnore}
          onCanceled={() => this.setState({modal: null})}
        />
        <CustomIgnoreCountModal
          show={this.state.modal === 'count'}
          onSelected={this.onCustomIgnore}
          onCanceled={() => this.setState({modal: null})}
          label={t('Ignore this issue until it occurs again .. ')}
          countLabel={t('Number of times')}
          countName="ignoreCount"
          windowName="ignoreWindow"
          windowChoices={this.getIgnoreWindows()}
        />
        <CustomIgnoreCountModal
          show={this.state.modal === 'users'}
          onSelected={this.onCustomIgnore}
          onCanceled={() => this.setState({modal: null})}
          label={t('Ignore this issue until it affects an additional .. ')}
          countLabel={t('Numbers of users')}
          countName="ignoreUserCount"
          windowName="ignoreUserWindow"
          windowChoices={this.getIgnoreWindows()}
        />
        <div className="btn-group">
          <a
            className={linkClassName}
            title={t('Ignore')}
            onClick={() => onUpdate({status: 'ignored'})}
          >
            <span className="icon-ban" style={{marginRight: 5}} />
            {t('Ignore')}
          </a>
          <DropdownLink caret={true} className={linkClassName} title="">
            <MenuItem header={true}>Ignore Until</MenuItem>
            <li className="dropdown-submenu">
              <DropdownLink
                title="This occurs again after .."
                caret={false}
                isNestedDropdown={true}
              >
                {this.getIgnoreDurations().map(duration => {
                  return (
                    <MenuItem noAnchor={true} key={duration}>
                      <a
                        onClick={this.onIgnore.bind(this, {
                          ignoreDuration: duration,
                        })}
                      >
                        <Duration seconds={duration * 60} />
                      </a>
                    </MenuItem>
                  );
                })}
                <MenuItem divider={true} />
                <MenuItem noAnchor={true}>
                  <a onClick={() => this.setState({modal: 'duration'})}>{t('Custom')}</a>
                </MenuItem>
              </DropdownLink>
            </li>
            <li className="dropdown-submenu">
              <DropdownLink
                title="This occurs again .."
                caret={false}
                isNestedDropdown={true}
              >
                {this.getIgnoreCounts().map(count => {
                  return (
                    <li className="dropdown-submenu" key={count}>
                      <DropdownLink
                        title={t('%s times', count.toLocaleString())}
                        caret={false}
                        isNestedDropdown={true}
                      >
                        <MenuItem noAnchor={true}>
                          <a
                            onClick={this.onIgnore.bind(this, {
                              ignoreCount: count,
                            })}
                          >
                            {t('from now')}
                          </a>
                        </MenuItem>
                        {this.getIgnoreWindows().map(([hours, label]) => {
                          return (
                            <MenuItem noAnchor={true} key={hours}>
                              <a
                                onClick={this.onIgnore.bind(this, {
                                  ignoreCount: count,
                                  ignoreWindow: hours,
                                })}
                              >
                                {label}
                              </a>
                            </MenuItem>
                          );
                        })}
                      </DropdownLink>
                    </li>
                  );
                })}
                <MenuItem divider={true} />
                <MenuItem noAnchor={true}>
                  <a onClick={() => this.setState({modal: 'count'})}>{t('Custom')}</a>
                </MenuItem>
              </DropdownLink>
            </li>
            <li className="dropdown-submenu">
              <DropdownLink
                title="This affects an additional .."
                caret={false}
                isNestedDropdown={true}
              >
                {this.getIgnoreCounts().map(count => {
                  return (
                    <li className="dropdown-submenu" key={count}>
                      <DropdownLink
                        title={t('%s users', count.toLocaleString())}
                        caret={false}
                        isNestedDropdown={true}
                      >
                        <MenuItem noAnchor={true}>
                          <a
                            onClick={this.onIgnore.bind(this, {
                              ignoreUserCount: count,
                            })}
                          >
                            {t('from now')}
                          </a>
                        </MenuItem>
                        {this.getIgnoreWindows().map(([hours, label]) => {
                          return (
                            <MenuItem noAnchor={true} key={hours}>
                              <a
                                onClick={this.onIgnore.bind(this, {
                                  ignoreUserCount: count,
                                  ignoreUserWindow: hours,
                                })}
                              >
                                {label}
                              </a>
                            </MenuItem>
                          );
                        })}
                      </DropdownLink>
                    </li>
                  );
                })}
                <MenuItem divider={true} />
                <MenuItem noAnchor={true}>
                  <a onClick={() => this.setState({modal: 'users'})}>{t('Custom')}</a>
                </MenuItem>
              </DropdownLink>
            </li>
          </DropdownLink>
        </div>
      </div>
    );
  },
});

const DeleteActions = React.createClass({
  propTypes: {
    organization: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
    onDelete: PropTypes.func.isRequired,
    onDiscard: PropTypes.func.isRequired,
  },

  getInitialState() {
    return {
      hooksDisabled: HookStore.get('project:discard-groups:disabled'),
    };
  },

  renderDisabledDiscard() {
    let {project, organization} = this.props;
    return this.state.hooksDisabled.map(hook => hook(organization, project));
  },

  renderDiscard() {
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
            <span>{t('Delete and discard future events')}</span>
          </LinkWithConfirmation>
        </li>
      </DropdownLink>
    );
  },

  render() {
    let features = new Set(this.props.project.features);
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
        {features.has('discard-groups')
          ? this.renderDiscard()
          : this.renderDisabledDiscard()}
      </div>
    );
  },
});

const GroupDetailsActions = React.createClass({
  mixins: [
    ApiMixin,
    GroupState,
    TooltipMixin({
      selector: '.tip',
      container: 'body',
    }),
  ],

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

          browserHistory.pushState(null, `/${org.slug}/${project.slug}/`);
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
        browserHistory.pushState(null, `/${org.slug}/${project.slug}/`);
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

    return (
      <div className="group-actions">
        <ResolveActions
          group={group}
          hasRelease={hasRelease}
          latestRelease={project.latestRelease}
          onUpdate={this.onUpdate}
          orgId={org.slug}
          projectId={project.slug}
        />
        <IgnoreActions group={group} onUpdate={this.onUpdate} />

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
          <a
            href={`/${this.getOrganization().slug}/${this.getProject()
              .slug}/settings/issue-tracking/`}
            className={'btn btn-default btn-sm btn-config-issue-tracking'}
          >
            {t('Link Issue Tracker')}
          </a>
        )}
      </div>
    );
  },
});

export default GroupDetailsActions;
