import React from 'react';
import Reflux from 'reflux';
import {Link} from 'react-router';

import TimeSince from './timeSince';
import DropdownLink from './dropdownLink';
import GroupChart from './stream/groupChart';
import GroupStore from '../stores/groupStore';
import Modal from 'react-bootstrap/lib/Modal';
import {t} from '../locale';

const SnoozeAction = React.createClass({
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

  render(){
    return (
      <a title={this.props.tooltip}
         className={this.props.className}
         disabled={this.props.disabled}
         onClick={this.toggleModal}>
        <span>zZz</span>

        <Modal show={this.state.isModalOpen} title={t('Please confirm')} animation={false}
               onHide={this.closeModal} bsSize="sm">
          <div className="modal-body">
            <h5>How long should we snooze this issue?</h5>
            <ul className="nav nav-stacked nav-pills">
              <li><a href="#">30 minutes</a></li>
              <li><a href="#">2 hours</a></li>
              <li><a href="#">24 hours</a></li>
              <li><a href="#">Forever</a></li>
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

const CompactIssue = React.createClass({
  propTypes: {
    id: React.PropTypes.string.isRequired,
  },

  mixins: [
    Reflux.listenTo(GroupStore, 'onGroupChange')
  ],

  getInitialState() {
    return {
      data: GroupStore.get(this.props.id)
    };
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.id != this.props.id) {
      this.setState({
        data: GroupStore.get(this.props.id)
      });
    }
  },

  onGroupChange(itemIds) {
    if (!itemIds.has(this.props.id)) {
      return;
    }
    let id = this.props.id;
    let data = GroupStore.get(id);
    this.setState({
      data: data,
    });
  },

  render() {
    let data = this.state.data;

    let className = 'issue row';
    if (data.isBookmarked) {
      className += ' isBookmarked';
    }
    if (data.hasSeen) {
      className += ' hasSeen';
    }
    if (data.status === 'resolved') {
      className += ' isResolved';
    }
    if (data.status === 'muted') {
      className += ' isMuted';
    }

    className += ' level-' + data.level;

    let {id, orgId} = this.props;
    let projectId = data.project.slug;

    let title = <span className="icon-more"></span>;

    return (
      <li className={className} onClick={this.toggleSelect}>
        <div className="col-md-9">
          <span className="error-level truncate" title={data.level}></span>
          <h3 className="truncate">
            <Link to={`/${orgId}/${projectId}/issues/${data.id}/`}>
              <span className="icon icon-soundoff hidden"></span>
              <span className="icon icon-bookmark hidden"></span>
              {data.title}
            </Link>
          </h3>
          <div className="event-extra">
            <ul>
              <li className="project-name">
                <Link to={`/${orgId}/${projectId}/`}>{data.project.name}</Link>
              </li>
              <li className="hidden">
                <span className="icon icon-clock"></span>
                <TimeSince date={data.lastSeen} />
                &nbsp;&mdash;&nbsp;
                <TimeSince date={data.firstSeen} suffix="old" />
              </li>
              {data.numComments !== 0 &&
                <li>
                  <Link to={`/${orgId}/${projectId}/issues/${id}/activity/`} className="comments">
                    <span className="icon icon-comments"></span>
                    <span className="tag-count">{data.numComments}</span>
                  </Link>
                </li>
              }
              <li className="culprit">{data.culprit}</li>
            </ul>
          </div>
        </div>
        {this.props.statsPeriod &&
          <div className="col-md-2 hidden-sm hidden-xs event-graph align-right">
            <GroupChart id={data.id} statsPeriod={this.props.statsPeriod} />
          </div>
        }
        <div className="col-md-1 align-right">
          <DropdownLink
            topLevelClasses="more-menu"
            className="more-menu-toggle"
            caret={false}
            title={title}>
            <li><a href="#"><span className="icon-checkmark" /></a></li>
            <li><a href="#"><span className="icon-bookmark" /></a></li>
            <li><SnoozeAction /></li>
            <li><a href="#"><span className="icon-user" /></a></li>
          </DropdownLink>
        </div>
      </li>
    );
  }
});

export default CompactIssue;
