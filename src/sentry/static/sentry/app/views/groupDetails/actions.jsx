import React from 'react';
import {browserHistory} from 'react-router';
import ApiMixin from '../../mixins/apiMixin';
import CustomIgnoreDurationModal from '../../components/customIgnoreDurationModal';
import DropdownLink from '../../components/dropdownLink';
import Duration from '../../components/duration';
import GroupState from '../../mixins/groupState';
import IndicatorStore from '../../stores/indicatorStore';
import IssuePluginActions from '../../components/group/issuePluginActions';
import MenuItem from '../../components/menuItem';
import LinkWithConfirmation from '../../components/linkWithConfirmation';
import TooltipMixin from '../../mixins/tooltip';
import {t} from '../../locale';

export default React.createClass({
  mixins: [
    ApiMixin,
    GroupState,
    TooltipMixin({
      selector: '.tip',
      container: 'body'
    })
  ],

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

  customIgnoreDurationClicked() {
    this.setState({
      isCustomIgnoreDurationModalOpen: true
    });
  },

  customIgnoreDurationSelected(duration) {
    this.onIgnore({ignoreDuration: duration});
    this.customIgnoreDurationCanceled();
  },

  customIgnoreDurationCanceled() {
    this.setState({
      isCustomIgnoreDurationModalOpen: false
    });
  },

  getIgnoreDurations() {
    return [30, 120, 60 * 24, 60 * 24 * 7];
  },

  getIgnoreCounts() {
    return [100, 1000, 10000, 100000];
  },

  render() {
    let group = this.getGroup();

    let resolveClassName = 'group-resolve btn btn-default btn-sm';
    if (group.status === 'resolved') {
      resolveClassName += ' active';
    }

    let resolveDropdownClasses = 'resolve-dropdown';

    let bookmarkClassName = 'group-bookmark btn btn-default btn-sm';
    if (group.isBookmarked) {
      bookmarkClassName += ' active';
    }

    let ignoreClassName = 'group-ignore btn btn-default btn-sm';
    if (group.status === 'ignored') {
      ignoreClassName += ' active';
    }

    let hasRelease = this.getProjectFeatures().has('releases');
    let releaseTrackingUrl =
      '/' +
      this.getOrganization().slug +
      '/' +
      this.getProject().slug +
      '/settings/release-tracking/';

    // account for both old and new style plugins
    let hasIssueTracking = group.pluginActions.length || group.pluginIssues.length;

    return (
      <div className="group-actions">
        <CustomIgnoreDurationModal
          show={this.state && this.state.isCustomIgnoreDurationModalOpen}
          onSelected={this.customIgnoreDurationSelected}
          onCanceled={this.customIgnoreDurationCanceled}
        />
        <div className="btn-group">
          {group.status === 'resolved'
            ? group.statusDetails.autoResolved
                ? <a
                    className={resolveClassName + ' tip'}
                    title={t(
                      'This event is resolved due to the Auto Resolve configuration for this project'
                    )}>
                    <span className="icon-checkmark" />
                  </a>
                : <a
                    className={resolveClassName}
                    title={t('Unresolve')}
                    onClick={this.onUpdate.bind(this, {status: 'unresolved'})}>
                    <span className="icon-checkmark" />
                  </a>
            : [
                <a
                  key="resolve-button"
                  className={resolveClassName}
                  title={t('Resolve')}
                  onClick={this.onUpdate.bind(this, {status: 'resolved'})}>
                  <span className="icon-checkmark" style={{marginRight: 5}} />
                  {t('Resolve')}
                </a>,
                <DropdownLink
                  key="resolve-dropdown"
                  caret={true}
                  className={resolveClassName}
                  topLevelClasses={resolveDropdownClasses}
                  title="">
                  <MenuItem noAnchor={true}>
                    {hasRelease
                      ? <a
                          onClick={this.onUpdate.bind(this, {
                            status: 'resolvedInNextRelease'
                          })}>
                          <strong>{t('Resolved in next release')}</strong>
                          <div className="help-text">
                            {t(
                              'Ignore notifications until this issue reoccurs in a future release.'
                            )}
                          </div>
                        </a>
                      : <a
                          href={releaseTrackingUrl}
                          className="disabled tip"
                          title={t(
                            'Set up release tracking in order to use this feature.'
                          )}>
                          <strong>{t('Resolved in next release.')}</strong>
                          <div className="help-text">
                            {t(
                              'Ignore notifications until this issue reoccurs in a future release.'
                            )}
                          </div>
                        </a>}
                  </MenuItem>
                </DropdownLink>
              ]}
        </div>
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
                      <a onClick={this.customIgnoreDurationClicked}>{t('custom')}</a>
                    </MenuItem>
                  </DropdownLink>
                </li>
                <li className="dropdown-submenu">
                  <DropdownLink title="This occurs again .." caret={false}>
                    <li className="dropdown-submenu">
                      {this.getIgnoreCounts().map(count => {
                        return (
                          <DropdownLink
                            title={t('%s times', count.toLocaleString())}
                            caret={false}
                            key={count}>
                            <MenuItem noAnchor={true}>
                              <a onClick={this.onIgnore.bind(this, {ignoreCount: count})}>
                                {t('ever')}
                              </a>
                            </MenuItem>
                          </DropdownLink>
                        );
                      })}
                    </li>
                    <MenuItem divider={true} />
                    <MenuItem noAnchor={true}>
                      <a>{t('custom')}</a>
                    </MenuItem>
                  </DropdownLink>
                </li>
                <li className="dropdown-submenu">
                  <DropdownLink title="Users affected reaches .." caret={false}>
                    <li className="dropdown-submenu">
                      {this.getIgnoreCounts().map(count => {
                        return (
                          <DropdownLink
                            title={t('%s times', count.toLocaleString())}
                            caret={false}
                            key={count}>
                            <MenuItem noAnchor={true}>
                              <a
                                onClick={this.onIgnore.bind(this, {
                                  ignoreUserCount: count
                                })}>
                                {t('ever')}
                              </a>
                            </MenuItem>
                          </DropdownLink>
                        );
                      })}
                    </li>
                    <MenuItem divider={true} />
                    <MenuItem noAnchor={true}>
                      <a>{t('custom')}</a>
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
