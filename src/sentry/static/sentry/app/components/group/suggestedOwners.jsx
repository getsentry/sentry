import React from 'react';
import createReactClass from 'create-react-class';
import ReactDOMServer from 'react-dom/server';
import moment from 'moment';
import styled from 'react-emotion';

import Avatar from '../avatar';
import ActorAvatar from '../actorAvatar';
import Tooltip from '../tooltip';
import ApiMixin from '../../mixins/apiMixin';
import GroupState from '../../mixins/groupState';
import {assignToUser, assignToActor} from '../../actionCreators/group';
import {t, tct} from '../../locale';
import Button from '../buttons/button';
import EmptyMessage from '../../views/settings/components/emptyMessage';
import {openCreateOwnershipRule} from '../../actionCreators/modal';
import SentryTypes from '../../proptypes';

const SuggestedOwners = createReactClass({
  displayName: 'SuggestedOwners',

  propTypes: {
    event: SentryTypes.Event,
    org: SentryTypes.Organization,
    project: SentryTypes.Project,
    group: SentryTypes.Group,
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
                    {t(`Sorry, we don't recognize this member. Make sure to link alternative
                    emails in Account Settings.`)}
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
    let name = `${owner.type === 'team' ? '#' : ''}${owner.name}`;
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
              <div className="tooltip-owners-name">
                {tct('[name] is suggested based on Issue Owner rule', {
                  name,
                })}
              </div>
              <ul className="tooltip-owners-commits">
                {rule[0] + t(' matched: ')}
                <code>{rule[1]}</code>
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
    let {org, project, group} = this.props;
    let {committers, owners} = this.state;
    let showOwners = new Set(org.features).has('code-owners');

    let isEmpty = (!committers || !committers.length) && (!owners || !owners.length);
    let canAddRule = org.access.indexOf('project:write') > -1;

    return (
      <div className="m-b-1">
        <h6>
          <span>{t('Owners')}</span>
          <small style={{background: '#FFFFFF'}}>{t('Click to assign')}</small>
        </h6>
        <div className="avatar-grid">
          {committers.map(this.renderCommitter)}
          {showOwners && owners.map(this.renderOwner)}

          {isEmpty && (
            <SmallEmptyMessage>
              <MessageWrapper>
                <Message>{t('No Owners')}</Message>{' '}
                {showOwners && (
                  <Tooltip
                    disabled={canAddRule}
                    title={t(
                      'You need project:write access to create an Issue Owner rule.'
                    )}
                  >
                    <Button
                      disabled={!canAddRule}
                      priority="primary"
                      size="xsmall"
                      onClick={() =>
                        openCreateOwnershipRule({
                          project,
                          organization: org,
                          issueId: group.id,
                        })}
                    >
                      {t('Add Rule')}
                    </Button>
                  </Tooltip>
                )}
              </MessageWrapper>
            </SmallEmptyMessage>
          )}
        </div>
      </div>
    );
  },
});

export default SuggestedOwners;

const SmallEmptyMessage = styled(EmptyMessage)`
  padding: 0;
  flex: 1;
  align-items: stretch;
`;

const Message = styled('span')`
  opacity: 0.4;
`;

const MessageWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
`;
