import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';

import ApiMixin from 'app/mixins/apiMixin';
import GroupState from 'app/mixins/groupState';
import CommitRow from 'app/components/commitRow';
import {t} from 'app/locale';

import {Panel} from 'app/components/panels';

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

    let commits = [];
    let commitSet = new Set();
    this.state.committers.forEach(committer => {
      committer.commits.forEach(commit => {
        if (!commitSet.has(commit.id)) {
          commitSet.add(commit.id);
          commits.push({
            ...commit,
            author: committer.author,
          });
        }
      });
    });
    return (
      <div className="box">
        <div className="box-header">
          <h3>
            {t('Suspect Commits')} ({commits.length})
          </h3>
        </div>
        <Panel>
          {commits.map(commit => {
            return <CommitRow key={commit.id} commit={commit} />;
          })}
        </Panel>
      </div>
    );
  },
});
