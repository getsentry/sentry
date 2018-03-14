import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import ReactDOMServer from 'react-dom/server';
import moment from 'moment';

import Avatar from '../avatar';
import ActorAvatar from '../actorAvatar';
import Tooltip from '../tooltip';
import ApiMixin from '../../mixins/apiMixin';
import GroupState from '../../mixins/groupState';
import {assignToUser, assignToActor} from '../../actionCreators/group';
import {t} from '../../locale';

const SuggestedOwners = createReactClass({
  displayName: 'SuggestedOwners',

  propTypes: {
    event: PropTypes.object,
  },

  mixins: [ApiMixin, GroupState],

  getInitialState() {
    return {
      rule: null,
      owners: [],
      committers: [],
    };
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
    if (!event) return;
    let org = this.getOrganization();
    let project = this.getProject();
    this.api.request(
      `/projects/${org.slug}/${project.slug}/events/${event.id}/committers/`,
      {
        success: (data, _, jqXHR) => {
          this.setState({
            committers: data.committers,
          });
        },
        error: error => {
          this.setState({
            committers: [],
          });
        },
      }
    );
    this.api.request(`/projects/${org.slug}/${project.slug}/events/${event.id}/owners/`, {
      success: (data, _, jqXHR) => {
        this.setState({
          owners: data.owners,
          rule: data.rule,
        });
      },
      error: error => {
        this.setState({
          owners: [],
        });
      },
    });
  },

  assignTo(user) {
    if (user.id !== undefined) {
      assignToUser({id: this.props.event.groupID, user});
    }
  },

  assignToActor(actor) {
    if (actor.id !== undefined) {
      assignToActor({
        actor,
        id: this.props.event.groupID,
      });
    }
  },

  renderCommitter(committer) {
    let {author, commits} = committer;
    return (
      <span
        key={author.id || author.email}
        className="avatar-grid-item"
        style={{cursor: 'pointer'}}
        onClick={() => this.assignTo(author)}
      >
        <Tooltip
          tooltipOptions={{
            html: true,
            container: 'body',
            template:
              '<div class="tooltip" role="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner tooltip-owners"></div></div>',
          }}
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
                      <div style={{whiteSpace: 'pre-line'}}>
                        {c.message.replace(
                          /\n\s*\n/g,
                          '\n'
                        ) /*repress repeated newlines*/}
                      </div>
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
        </Tooltip>
      </span>
    );
  },

  renderOwner(owner) {
    let {rule} = this.state;
    return (
      <span
        key={`${owner.id}:${owner.type}`}
        className="avatar-grid-item"
        style={{cursor: 'pointer'}}
        onClick={() => this.assignToActor(owner)}
      >
        <Tooltip
          tooltipOptions={{
            html: true,
            container: 'body',
            template:
              '<div class="tooltip" role="tooltip"><div class="tooltip-arrow"></div><div class="tooltip-inner tooltip-owners"></div></div>',
          }}
          title={ReactDOMServer.renderToStaticMarkup(
            <div>
              <div className="tooltip-owners-name">{owner.name}</div>
              <ul className="tooltip-owners-commits">
                {t("Assigned based on your Project's Issue Ownership settings")}
              </ul>
              <ul className="tooltip-owners-commits">
                {rule[0] + t(' matched: ') + rule[1]}
              </ul>
            </div>
          )}
        >
          <ActorAvatar actor={owner} hasTooltip={false} />
        </Tooltip>
      </span>
    );
  },

  render() {
    let {committers, owners} = this.state;
    let showOwners = new Set(this.getOrganization().features).has('internal-catchall');

    if (committers.length == 0 && (!showOwners || owners.length == 0)) {
      return null;
    }

    return (
      <div className="m-b-1">
        <h6>
          <span>{t('Suggested Assignees')}</span>
          <small style={{background: '#FFFFFF'}}>{t('Click to assign')}</small>
        </h6>
        <div className="avatar-grid">
          {committers.map(this.renderCommitter)}
          {showOwners && owners.map(this.renderOwner)}
        </div>
      </div>
    );
  },
});

export default SuggestedOwners;
