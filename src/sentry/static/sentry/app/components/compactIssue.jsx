import React from 'react';
import Reflux from 'reflux';
import {Link} from 'react-router';
import Modal from 'react-bootstrap/lib/Modal';

import ApiMixin from '../mixins/apiMixin';
import IndicatorStore from '../stores/indicatorStore';
import DropdownLink from './dropdownLink';
import GroupChart from './stream/groupChart';
import GroupStore from '../stores/groupStore';
import {t} from '../locale';

const Snooze = {
  // all values in minutes
  '30MINUTES': 30,
  '2HOURS': 60 * 2,
  '24HOURS': 60 * 24,
};


const SnoozeAction = React.createClass({
  propTypes: {
    disabled: React.PropTypes.bool,
    onSnooze: React.PropTypes.func.isRequired,
    tooltip: React.PropTypes.string
  },

  getInitialState() {
    return {
      isModalOpen: false
    };
  },

  toggleModal() {
    if (this.props.disabled) {
      return;
    }
    this.setState({
      isModalOpen: !this.state.isModalOpen
    });
  },

  closeModal() {
    this.setState({isModalOpen: false});
  },

  onSnooze(duration) {
    this.props.onSnooze(duration);
    this.closeModal();
  },

  render(){
    return (
      <a title={this.props.tooltip}
         className={this.props.className}
         disabled={this.props.disabled}
         onClick={this.toggleModal}>
        <span>{t('zZz')}</span>

        <Modal show={this.state.isModalOpen} title={t('Please confirm')} animation={false}
               onHide={this.closeModal} bsSize="sm">
          <div className="modal-body">
            <h5>{t('How long should we snooze this issue?')}</h5>
            <ul className="nav nav-stacked nav-pills">
              <li><a onClick={this.onSnooze.bind(this, Snooze['30MINUTES'])}>{t('30 minutes')}</a></li>
              <li><a onClick={this.onSnooze.bind(this, Snooze['2HOURS'])}>{t('2 hours')}</a></li>
              <li><a onClick={this.onSnooze.bind(this, Snooze['24HOURS'])}>{t('24 hours')}</a></li>
              <li><a onClick={this.onSnooze}>{t('Forever')}</a></li>
            </ul>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-default"
                    onClick={this.closeModal}>{t('Cancel')}</button>
          </div>
        </Modal>
      </a>
    );
  }
});

const CompactIssueHeader = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
  },

  getTitle() {
    let data = this.props.data;
    let metadata = data.metadata;
    switch (data.type) {
      case 'error':
        return (
          <span>
            <span style={{marginRight: 10}}>{metadata.type}</span>
            <em style={{fontSize: '80%', color: '#6F7E94', fontWeight: 'normal'}}>{data.culprit}</em><br/>
          </span>
        );
      case 'csp':
        return (
          <span>
            <span style={{marginRight: 10}}>{metadata.directive}</span>
            <em style={{fontSize: '80%', color: '#6F7E94', fontWeight: 'normal'}}>{metadata.uri}</em><br/>
          </span>
        );
      case 'default':
        return <span>{metadata.title}</span>;
      default:
        return <span>{data.title}</span>;
    }
  },

  getMessage() {
    let data = this.props.data;
    let metadata = data.metadata;
    switch (data.type) {
      case 'error':
        return metadata.value;
      case 'csp':
        return metadata.message;
      default:
        return '';
    }
  },

  render() {
    let {orgId, projectId, data} = this.props;
    return (
      <div>
        <span className="error-level truncate" title={data.level} />
        <h3 className="truncate">
          <Link to={`/${orgId}/${projectId}/issues/${data.id}/`}>
            <span className="icon icon-soundoff" />
            <span className="icon icon-star-solid" />
            {this.getTitle()}
          </Link>
        </h3>
        <div className="event-extra">
          <span className="project-name">
            <Link to={`/${orgId}/${projectId}/`}>{data.project.name}</Link>
          </span>
          {data.numComments !== 0 &&
            <span>
              <Link to={`/${orgId}/${projectId}/issues/${data.id}/activity/`} className="comments">
                <span className="icon icon-comments" />
                <span className="tag-count">{data.numComments}</span>
              </Link>
            </span>
          }
          <span className="culprit">{this.getMessage()}</span>
        </div>
      </div>
    );
  }
});

const CompactIssue = React.createClass({
  propTypes: {
    data: React.PropTypes.object,
    id: React.PropTypes.string,
    orgId: React.PropTypes.string,
    statsPeriod: React.PropTypes.string
  },

  mixins: [
    ApiMixin,
    Reflux.listenTo(GroupStore, 'onGroupChange')
  ],

  getInitialState() {
    return {
      issue: this.props.data || GroupStore.get(this.props.id)
    };
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.id != this.props.id) {
      this.setState({
        issue: GroupStore.get(this.props.id)
      });
    }
  },

  onGroupChange(itemIds) {
    if (!itemIds.has(this.props.id)) {
      return;
    }
    let id = this.props.id;
    let issue = GroupStore.get(id);
    this.setState({
      issue: issue,
    });
  },

  onSnooze(duration) {
    this.onUpdate({
      status: 'muted',
      snoozeDuration: duration,
    });
  },

  onUpdate(data) {
    let issue = this.state.issue;
    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));

    this.api.bulkUpdate({
      orgId: this.props.orgId,
      projectId: issue.project.slug,
      itemIds: [issue.id],
        data: data,
    }, {
      complete: () => {
        IndicatorStore.remove(loadingIndicator);
      }
    });
  },

  render() {
    let issue = this.state.issue;

    let className = 'issue';
    if (issue.isBookmarked) {
      className += ' isBookmarked';
    }
    if (issue.hasSeen) {
      className += ' hasSeen';
    }
    if (issue.status === 'resolved') {
      className += ' isResolved';
    }
    if (issue.status === 'muted') {
      className += ' isMuted';
    }

    className += ' level-' + issue.level;

    if (this.props.statsPeriod) {
      className += ' with-graph';
    }

    let {id, orgId} = this.props;
    let projectId = issue.project.slug;
    let title = <span className="icon-more"></span>;

    return (
      <li className={className} onClick={this.toggleSelect}>
        <CompactIssueHeader data={issue} orgId={orgId} projectId={projectId} />
        {this.props.statsPeriod &&
          <div className="event-graph">
            <GroupChart id={id} statsPeriod={this.props.statsPeriod} />
          </div>
        }
        <div className="more-menu-container align-right">
          <DropdownLink
            topLevelClasses="more-menu"
            className="more-menu-toggle"
            caret={false}
            title={title}>
            <li>
              <a onClick={this.onUpdate.bind(this, {status: issue.status !== 'resolved' ? 'resolved' : 'unresolved'})}>
                <span className="icon-checkmark" />
              </a>
            </li>
            <li>
              <a onClick={this.onUpdate.bind(this, {isBookmarked: !issue.isBookmarked})}>
                <span className="icon-star-solid" />
              </a>
            </li>
            <li>
              <SnoozeAction
                orgId={orgId}
                projectId={projectId}
                groupId={id}
                onSnooze={this.onSnooze} />
            </li>
            {false &&
              <li><a href="#"><span className="icon-user" /></a></li>
            }
          </DropdownLink>
        </div>
        {this.props.children}
      </li>
    );
  }
});

export default CompactIssue;
