import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import ReactDOMServer from 'react-dom/server';
import moment from 'moment';

import Avatar from '../avatar';
import TooltipMixin from '../../mixins/tooltip';
import ApiMixin from '../../mixins/apiMixin';
import GroupState from '../../mixins/groupState';
import TimeSince from '../timeSince';
import {assignTo} from '../../actionCreators/group';

export default createReactClass({
  displayName: 'EventCause',

  propTypes: {
    event: PropTypes.object,
  },

  mixins: [
    ApiMixin,
    GroupState,
    TooltipMixin({
      selector: '.tip',
      html: true,
      container: 'body',
      template:
        '<div class="tooltip" role="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner tooltip-owners"></div></div>',
    }),
  ],

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

  componentDidUpdate(_, nextState) {
    //this shallow equality should be OK because it's being mutated fetchData as a new object
    if (this.state.owners !== nextState.owners) {
      this.removeTooltips();
      this.attachTooltips();
    }
  },

  fetchData(event) {
    // TODO(dcramer): this API request happens twice, and we need a store for it
    if (!event) return;
    let org = this.getOrganization();
    let project = this.getProject();
    this.api.request(
      `/projects/${org.slug}/${project.slug}/events/${event.id}/committers/`,
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

  assignTo(member) {
    if (member.id !== undefined) {
      assignTo({id: this.props.event.groupID, member});
    }
  },

  renderCommitter(owner) {
    let {author, commits} = owner;
    return (
      <span
        key={author.id || author.email}
        className="avatar-grid-item tip"
        onClick={() => this.assignTo(author)}
        title={ReactDOMServer.renderToStaticMarkup(
          <div>
            {author.id ? (
              <div className="tooltip-owners-name">{author.name}</div>
            ) : (
              <div className="tooltip-owners-unknown">
                <p className="tooltip-owners-unknown-email">
                  <span className="icon icon-circle-cross" />
                  <strong>{author.email}</strong>
                </p>
                <p>
                  Sorry, we don't recognize this member. Make sure to link alternative
                  emails in Account Settings.
                </p>
                <hr />
              </div>
            )}
            <ul className="tooltip-owners-commits">
              {commits.slice(0, 6).map(c => {
                return (
                  <li key={c.id} className="tooltip-owners-commit">
                    {c.message}
                    <span className="tooltip-owners-date">
                      {' '}
                      - {moment(c.dateCreated).fromNow()}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      >
        <Avatar user={author} />
      </span>
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

    let probablyTheCommit = commitsWithAge[0][1];
    let commitBits = probablyTheCommit.message.split('\n');
    let subject = commitBits[0];
    let message =
      commitBits.length > 1
        ? commitBits
            .slice(1)
            .join('\n')
            .replace(/^\s+|\s+$/g, '')
        : null;
    return (
      <div className="box">
        <div className="box-header">
          <h3>Likely Culprit</h3>
        </div>
        <div style={{fontSize: '0.8em', fontWeight: 'bold', marginBottom: 10}}>
          {subject}
        </div>
        {!!message && (
          <pre
            style={{marginBottom: 10, background: 'none', padding: 0, fontSize: '0.8em'}}
          >
            {message}
          </pre>
        )}
        <div style={{marginBottom: 20, fontSize: '0.7em', color: '#999', lineHeight: 1}}>
          {!!probablyTheCommit.author ? (
            <strong>{probablyTheCommit.author.name}</strong>
          ) : (
            <strong>
              <em>Unknown Author</em>
            </strong>
          )}{' '}
          committed <TimeSince date={probablyTheCommit.dateCreated} />
        </div>
      </div>
    );
  },
});
