import React from 'react';
import {browserHistory} from 'react-router';
import ApiMixin from '../../mixins/apiMixin';
import CustomIgnoreCountModal from '../../components/customIgnoreCountModal';
import CustomIgnoreDurationModal from '../../components/customIgnoreDurationModal';
import CustomResolutionModal from '../../components/customResolutionModal';
import DropdownLink from '../../components/dropdownLink';
import Duration from '../../components/duration';
import GroupState from '../../mixins/groupState';
import IndicatorStore from '../../stores/indicatorStore';
import IssuePluginActions from '../../components/group/issuePluginActions';
import MenuItem from '../../components/menuItem';
import LinkWithConfirmation from '../../components/linkWithConfirmation';
import TooltipMixin from '../../mixins/tooltip';
import {t} from '../../locale';

const ResolveActions = React.createClass({
  propTypes: {
    group: React.PropTypes.object.isRequired,
    hasRelease: React.PropTypes.bool.isRequired,
    onUpdate: React.PropTypes.func.isRequired,
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired
  },

  getInitialState() {
    return {
      modal: false
    };
  },

  onCustomResolution(data) {
    this.setState({
      modal: false
    });
    this.props.onUpdate(data);
  },

  render() {
    let {group, hasRelease, onUpdate} = this.props;
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
            )}>
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
            onClick={() => onUpdate({status: 'unresolved'})}>
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
            onClick={() => onUpdate({status: 'resolved'})}>
            <span className="icon-checkmark" style={{marginRight: 5}} />
            {t('Resolve')}
          </a>
          <DropdownLink
            key="resolve-dropdown"
            caret={true}
            className={resolveClassName}
            title="">
            <MenuItem header={true}>Resolved In</MenuItem>
            <MenuItem noAnchor={true}>
              <a
                onClick={() => {
                  return (
                    hasRelease &&
                    onUpdate({
                      status: 'resolved',
                      statusDetails: {
                        inNextRelease: true
                      }
                    })
                  );
                }}
                className={actionClassName}
                title={actionTitle}>
                {t('The next release')}
              </a>
              <a
                onClick={() => {
                  return (
                    hasRelease &&
                    onUpdate({
                      status: 'resolved',
                      statusDetails: {
                        inRelease: 'latest'
                      }
                    })
                  );
                }}
                className={actionClassName}
                title={actionTitle}>
                {t('The current release')}
              </a>
              <a
                onClick={() => hasRelease && this.setState({modal: true})}
                className={actionClassName}
                title={actionTitle}>
                {t('Another version ...')}
              </a>
            </MenuItem>
          </DropdownLink>
        </div>
      </div>
    );
  }
});

export default React.createClass({
  mixins: [
    ApiMixin,
    GroupState,
    TooltipMixin({
      selector: '.tip',
      container: 'body'
    })
  ],

  getInitialState() {
    return {ignoreModal: null};
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
        itemIds: [group.id]
      },
      {
        complete: () => {
          IndicatorStore.remove(loadingIndicator);

          browserHistory.pushState(null, `/${org.slug}/${project.slug}/`);
        }
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
        data: data
      },
      {
        complete: () => {
          IndicatorStore.remove(loadingIndicator);
        }
      }
    );
  },

  onToggleBookmark() {
    this.onUpdate({isBookmarked: !this.getGroup().isBookmarked});
  },

  onIgnore(params) {
    this.onUpdate({
      status: 'ignored',
      ...params
    });
  },

  customIgnoreModalClicked(modal) {
    this.setState({
      ignoreModal: modal
    });
  },

  customIgnoreModalSelected(data) {
    this.onIgnore(data);
    this.customIgnoreModalCanceled();
  },

  customIgnoreModalCanceled() {
    this.setState({ignoreModal: null});
  },

  getIgnoreDurations() {
    return [30, 120, 360, 60 * 24, 60 * 24 * 7];
  },

  getIgnoreCounts() {
    return [100, 1000, 10000, 100000];
  },

  getIgnoreWindows() {
    return [[1, 'per hour'], [24, 'per day'], [24 * 7, 'per week']];
  },

  render() {
    let group = this.getGroup();
    let project = this.getProject();
    let org = this.getOrganization();

    let bookmarkClassName = 'group-bookmark btn btn-default btn-sm';
    if (group.isBookmarked) {
      bookmarkClassName += ' active';
    }

    let ignoreClassName = 'group-ignore btn btn-default btn-sm';
    if (group.status === 'ignored') {
      ignoreClassName += ' active';
    }

    let hasRelease = this.getProjectFeatures().has('releases');

    // account for both old and new style plugins
    let hasIssueTracking = group.pluginActions.length || group.pluginIssues.length;

    return (
      <div className="group-actions">
        <CustomIgnoreDurationModal
          show={this.state.ignoreModal === 'duration'}
          onSelected={this.customIgnoreModalSelected}
          onCanceled={this.customIgnoreModalCanceled.bind(this, 'duration')}
        />
        <CustomIgnoreCountModal
          show={this.state.ignoreModal === 'count'}
          onSelected={this.customIgnoreModalSelected}
          onCanceled={this.customIgnoreModalCanceled.bind(this, 'count')}
          label={t('Ignore this issue until it occurs again .. ')}
          countLabel={t('Number of times')}
          countName="ignoreCount"
          windowName="ignoreWindow"
          windowChoices={this.getIgnoreWindows()}
        />
        <CustomIgnoreCountModal
          show={this.state.ignoreModal === 'users'}
          onSelected={this.customIgnoreModalSelected}
          onCanceled={this.customIgnoreModalCanceled.bind(this, 'users')}
          label={t('Ignore this issue until it affects an additional .. ')}
          countLabel={t('Numbers of users')}
          countName="ignoreUserCount"
          windowName="ignoreUserWindow"
          windowChoices={this.getIgnoreWindows()}
        />
        <ResolveActions
          group={group}
          hasRelease={hasRelease}
          onUpdate={this.onUpdate}
          orgId={org.slug}
          projectId={project.slug}
        />
        <div className="btn-group">
          {group.status === 'ignored'
            ? <a
                className={ignoreClassName}
                title={t('Remove Ignored Status')}
                onClick={this.onUpdate.bind(this, {status: 'unresolved'})}>
                {t('Ignore')}
              </a>
            : <DropdownLink
                caret={false}
                className={ignoreClassName}
                title={
                  <span>
                    {t('Ignore')}
                    <span
                      className="icon-arrow-down"
                      style={{marginLeft: 3, marginRight: -3}}
                    />
                  </span>
                }>
                <MenuItem header={true}>Ignore Until</MenuItem>
                <li className="dropdown-submenu">
                  <DropdownLink title="This occurs again after .." caret={false}>
                    {this.getIgnoreDurations().map(duration => {
                      return (
                        <MenuItem noAnchor={true} key={duration}>
                          <a
                            onClick={this.onIgnore.bind(this, {
                              ignoreDuration: duration
                            })}>
                            <Duration seconds={duration * 60} />
                          </a>
                        </MenuItem>
                      );
                    })}
                    <MenuItem divider={true} />
                    <MenuItem noAnchor={true}>
                      <a onClick={this.customIgnoreModalClicked.bind(this, 'duration')}>
                        {t('Custom')}
                      </a>
                    </MenuItem>
                  </DropdownLink>
                </li>
                <li className="dropdown-submenu">
                  <DropdownLink title="This occurs again .." caret={false}>
                    {this.getIgnoreCounts().map(count => {
                      return (
                        <li className="dropdown-submenu" key={count}>
                          <DropdownLink
                            title={t('%s times', count.toLocaleString())}
                            caret={false}>
                            <MenuItem noAnchor={true}>
                              <a
                                onClick={this.onIgnore.bind(this, {
                                  ignoreCount: count
                                })}>
                                {t('from now')}
                              </a>
                            </MenuItem>
                            {this.getIgnoreWindows().map(([hours, label]) => {
                              return (
                                <MenuItem noAnchor={true} key={hours}>
                                  <a
                                    onClick={this.onIgnore.bind(this, {
                                      ignoreCount: count,
                                      ignoreWindow: hours
                                    })}>
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
                      <a onClick={this.customIgnoreModalClicked.bind(this, 'count')}>
                        {t('Custom')}
                      </a>
                    </MenuItem>
                  </DropdownLink>
                </li>
                <li className="dropdown-submenu">
                  <DropdownLink title="This affects an additional .." caret={false}>
                    {this.getIgnoreCounts().map(count => {
                      return (
                        <li className="dropdown-submenu" key={count}>
                          <DropdownLink
                            title={t('%s users', count.toLocaleString())}
                            caret={false}>
                            <MenuItem noAnchor={true}>
                              <a
                                onClick={this.onIgnore.bind(this, {
                                  ignoreUserCount: count
                                })}>
                                {t('from now')}
                              </a>
                            </MenuItem>
                            {this.getIgnoreWindows().map(([hours, label]) => {
                              return (
                                <MenuItem noAnchor={true} key={hours}>
                                  <a
                                    onClick={this.onIgnore.bind(this, {
                                      ignoreUserCount: count,
                                      ignoreUserWindow: hours
                                    })}>
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
                      <a onClick={this.customIgnoreModalClicked.bind(this, 'users')}>
                        {t('Custom')}
                      </a>
                    </MenuItem>
                  </DropdownLink>
                </li>
                <MenuItem noAnchor={true}>
                  <a onClick={this.onUpdate.bind(this, {status: 'ignored'})}>
                    {t('Forever')}
                  </a>
                </MenuItem>
              </DropdownLink>}
        </div>
        <div className="btn-group">
          <a
            className={bookmarkClassName}
            title={t('Bookmark')}
            onClick={this.onToggleBookmark}>
            <span className="icon-star-solid" />
          </a>
        </div>
        <div className="btn-group">
          <LinkWithConfirmation
            className="group-remove btn btn-default btn-sm"
            title={t('Delete')}
            message={t(
              'Deleting this event is permanent. Are you sure you wish to continue?'
            )}
            onConfirm={this.onDelete}>
            <span className="icon-trash" />
          </LinkWithConfirmation>
        </div>
        {group.pluginActions.length > 1
          ? <div className="btn-group more">
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
          : group.pluginActions.length !== 0 &&
              group.pluginActions.map((action, actionIdx) => {
                return (
                  <div className="btn-group" key={actionIdx}>
                    <a className="btn btn-default btn-sm" href={action[1]}>
                      {action[0]}
                    </a>
                  </div>
                );
              })}
        {group.pluginIssues &&
          group.pluginIssues.map(plugin => {
            return <IssuePluginActions key={plugin.slug} plugin={plugin} />;
          })}
        {!hasIssueTracking &&
          <a
            href={`/${this.getOrganization().slug}/${this.getProject().slug}/settings/issue-tracking/`}
            className={'btn btn-default btn-sm btn-config-issue-tracking'}>
            {t('Link Issue Tracker')}
          </a>}
      </div>
    );
  }
});
