import React from 'react';
import {browserHistory} from 'react-router';
import ApiMixin from '../../mixins/apiMixin';
import DropdownLink from '../../components/dropdownLink';
import CustomSnoozeModal from '../../components/customSnoozeModal';
import GroupState from '../../mixins/groupState';
import IndicatorStore from '../../stores/indicatorStore';
import IssuePluginActions from '../../components/group/issuePluginActions';
import MenuItem from '../../components/menuItem';
import LinkWithConfirmation from '../../components/linkWithConfirmation';
import TooltipMixin from '../../mixins/tooltip';
import {defined} from '../../utils';
import {t} from '../../locale';

const Snooze = {
  // all values in minutes
  '30MINUTES': 30,
  '2HOURS': 60 * 2,
  '24HOURS': 60 * 24,
  'ONEWEEK': 60 * 24 * 7,
};

const GroupActions = React.createClass({
  mixins: [
    ApiMixin,
    GroupState,
    TooltipMixin({
      selector: '.tip',
      container: 'body',
    }),
  ],

  onDelete() {
    let group = this.getGroup();
    let project = this.getProject();
    let org = this.getOrganization();
    let loadingIndicator = IndicatorStore.add(t('Delete event..'));

    this.api.bulkDelete({
      orgId: org.slug,
      projectId: project.slug,
      itemIds: [group.id]
    }, {
      complete: () => {
        IndicatorStore.remove(loadingIndicator);

        browserHistory.pushState(null, `/${org.slug}/${project.slug}/`);
      }
    });
  },

  onUpdate(data) {
    let group = this.getGroup();
    let project = this.getProject();
    let org = this.getOrganization();
    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));

    this.api.bulkUpdate({
      orgId: org.slug,
      projectId: project.slug,
      itemIds: [group.id],
      data: data,
    }, {
      complete: () => {
        IndicatorStore.remove(loadingIndicator);
      }
    });
  },

  onToggleBookmark() {
    this.onUpdate({isBookmarked: !this.getGroup().isBookmarked});
  },

  onSnooze(duration) {
    this.onUpdate({
      status: 'ignored',
      ignoreDuration: duration,
    });
  },

  customSnoozeClicked() {
    this.setState({
      isCustomSnoozeModalOpen: true
    });
  },

  customSnoozeSelected(duration) {
    this.onSnooze(duration);
    this.customSnoozeCanceled();
  },

  customSnoozeCanceled() {
    this.setState({
      isCustomSnoozeModalOpen: false
    });
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

    let hasRelease = defined(group.lastRelease);
    let releaseTrackingUrl = '/' + this.getOrganization().slug + '/' + this.getProject().slug + '/settings/release-tracking/';

    // account for both old and new style plugins
    let hasIssueTracking = group.pluginActions.length || group.pluginIssues.length;

    return (
      <div className="group-actions">
        <CustomSnoozeModal
            show={this.state && this.state.isCustomSnoozeModalOpen}
            onSelected={this.customSnoozeSelected}
            onCanceled={this.customSnoozeCanceled}/>
        <div className="btn-group">
          {group.status === 'resolved' ? (
            group.statusDetails.autoResolved ?
             <a className={resolveClassName + ' tip'}
                 title={t('This event is resolved due to the Auto Resolve configuration for this project')}>
                <span className="icon-checkmark" />
              </a>
            :
              <a className={resolveClassName}
                 title={t('Unresolve')}
                 onClick={this.onUpdate.bind(this, {status: 'unresolved'})}>
                <span className="icon-checkmark" />
              </a>
            )
          :
            [
              <a key="resolve-button"
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
                  {hasRelease ?
                    <a onClick={this.onUpdate.bind(this, {status: 'resolvedInNextRelease'})}>
                      <strong>{t('Resolved in next release')}</strong>
                      <div className="help-text">{t('Snooze notifications until this issue reoccurs in a future release.')}</div>
                    </a>
                  :
                    <a href={releaseTrackingUrl} className="disabled tip" title={t('Set up release tracking in order to use this feature.')}>
                      <strong>{t('Resolved in next release.')}</strong>
                      <div className="help-text">{t('Snooze notifications until this issue reoccurs in a future release.')}</div>
                    </a>
                  }
                </MenuItem>
              </DropdownLink>
            ]
          }
        </div>
        <div className="btn-group">
          {group.status === 'ignored' ?
            <a className={ignoreClassName}
               title={t('Remove Ignored Status')}
               onClick={this.onUpdate.bind(this, {status: 'unresolved'})}>
             {t('Ignore')}
            </a>
          :
            <DropdownLink
              caret={false}
              className={ignoreClassName}
              title={<span>
                {t('Ignore')}
                <span className="icon-arrow-down" style={{marginLeft: 3, marginRight: -3}} />
              </span>}>
              <MenuItem noAnchor={true}>
                <a onClick={this.onSnooze.bind(this, Snooze['30MINUTES'])}>{t('for 30 minutes')}</a>
              </MenuItem>
              <MenuItem noAnchor={true}>
                <a onClick={this.onSnooze.bind(this, Snooze['2HOURS'])}>{t('for 2 hours')}</a>
              </MenuItem>
              <MenuItem noAnchor={true}>
                <a onClick={this.onSnooze.bind(this, Snooze['24HOURS'])}>{t('for 24 hours')}</a>
              </MenuItem>
              <MenuItem noAnchor={true}>
                <a onClick={this.onSnooze.bind(this, Snooze.ONEWEEK)}>{t('for 1 week')}</a>
              </MenuItem>
              <MenuItem noAnchor={true}>
                <a onClick={this.customSnoozeClicked}>{t('until custom date...')}</a>
              </MenuItem>
              <MenuItem noAnchor={true}>
                <a onClick={this.onUpdate.bind(this, {status: 'ignored'})}>{t('forever')}</a>
              </MenuItem>
            </DropdownLink>
          }
        </div>
        <div className="btn-group">
          <a className={bookmarkClassName}
             title={t('Bookmark')}
             onClick={this.onToggleBookmark}>
            <span className="icon-star-solid" />
          </a>
        </div>
        <div className="btn-group">
          <LinkWithConfirmation
               className="group-remove btn btn-default btn-sm"
               title={t('Delete')}
               message={t('Deleting this event is permanent. Are you sure you wish to continue?')}
               onConfirm={this.onDelete}>
            <span className="icon-trash"></span>
          </LinkWithConfirmation>
        </div>
        {group.pluginActions.length > 1 ?
          <div className="btn-group more">
            <DropdownLink
                className="btn btn-default btn-sm"
                title={t('More')}>
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
                <a className="btn btn-default btn-sm"
                   href={action[1]}>
                  {action[0]}
                </a>
              </div>
            );
          })
        }
        {group.pluginIssues && group.pluginIssues.map((plugin) => {
          return <IssuePluginActions key={plugin.slug} plugin={plugin}/>;
        })}
        {!hasIssueTracking &&
          <a href={`/${this.getOrganization().slug}/${this.getProject().slug}/settings/issue-tracking/`}
             className={'btn btn-default btn-sm btn-config-issue-tracking'}>
            {t('Link Issue Tracker')}
          </a>
        }
      </div>
    );
  }
});

export default GroupActions;
