import idx from 'idx';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import moment from 'moment';

import Avatar from '../avatar';
import ApiMixin from '../../mixins/apiMixin';
import GroupState from '../../mixins/groupState';
import TimeSince from '../timeSince';
import CommitLink from '../commitLink';
import {t} from '../../locale';

class Commit extends React.Component {
  static propTypes = {
    commit: PropTypes.object,
  };

  renderMessage = message => {
    if (!message) {
      return t('No message provided');
    }

    let firstLine = message.split(/\n/)[0];

    return firstLine;
  };

  render() {
    let {id, dateCreated, message, author, repository} = this.props.commit;
    return (
      <li className="list-group-item" key={id}>
        <div className="row row-center-vertically">
          <div className="col-xs-10 list-group-avatar">
            <Avatar user={author} />
            <h5 className="truncate">{this.renderMessage(message)}</h5>
            <p>
              <strong>{idx(author, _ => _.name) || t('Unknown author')}</strong> committed{' '}
              <TimeSince date={dateCreated} />
            </p>
          </div>
          <div className="col-xs-2 align-right">
            <CommitLink commitId={id} repository={repository} />
          </div>
        </div>
      </li>
    );
  }
}

export default createReactClass({
  displayName: 'EventCause',

  propTypes: {
    event: PropTypes.object.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
  },

  mixins: [ApiMixin, GroupState],

  getInitialState() {
    return {committers: undefined};
  },

  componentDidMount() {
    this.fetchData(this.props.event);
  },

  componentWillReceiveProps(nextProps) {
    if (this.props.event && nextProps.event) {
      if (this.props.event.id !== nextProps.event.id) {
        //two events, with different IDs
        this.fetchData(nextProps.event);
      }
    } else if (nextProps.event) {
      //going from having no event to having an event
      this.fetchData(nextProps.event);
    }
  },

  fetchData(event) {
    // TODO(dcramer): this API request happens twice, and we need a store for it
    if (!event) return;
    this.api.request(
      `/projects/${this.props.orgId}/${this.props
        .projectId}/events/${event.id}/committers/`,
      {
        success: (data, _, jqXHR) => {
          this.setState(data);
        },
        error: error => {
          this.setState({
            committers: undefined,
          });
        },
      }
    );
  },

  render() {
    if (!(this.state.committers && this.state.committers.length)) {
      return null;
    }

    let commitsWithAge = [];
    this.state.committers.forEach(committer => {
      committer.commits.forEach(commit => {
        commitsWithAge.push([moment(commit.dateCreated), commit]);
      });
    });
    let firstSeen = moment(this.getGroup().firstSeen);
    commitsWithAge
      .filter(([age, commit]) => {
        return age < 604800;
      })
      .sort((a, b) => {
        return firstSeen - a[0] - (firstSeen - b[0]);
      });
    if (!commitsWithAge.length) return null;
    return (
      <div className="box">
        <div className="box-header">
          <h3>
            {t('Suspect Commits')} ({commitsWithAge.length})
          </h3>
        </div>
        <ul className="list-group list-group-lg commit-list">
          {commitsWithAge.map(([age, commit]) => {
            return <Commit key={commit.id} commit={commit} />;
          })}
        </ul>
      </div>
    );
  },
});
