import React from 'react';
import createReactClass from 'create-react-class';

import {assignToUser, assignToActor} from 'app/actionCreators/group';
import {openCreateOwnershipRule} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import Access from 'app/components/acl/access';
import ActorAvatar from 'app/components/actorAvatar';
import ApiMixin from 'app/mixins/apiMixin';
import Button from 'app/components/button';
import OrganizationState from 'app/mixins/organizationState';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import SentryTypes from 'app/sentryTypes';
import SuggestedOwnerHovercard from 'app/components/group/suggestedOwnerHovercard';

const SuggestedOwners = createReactClass({
  displayName: 'SuggestedOwners',

  propTypes: {
    project: SentryTypes.Project,
    group: SentryTypes.Group,
    event: SentryTypes.Event,
  },

  mixins: [ApiMixin, OrganizationState],

  getInitialState() {
    return {
      rules: null,
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
    if (!event) {
      return;
    }
    const org = this.getOrganization();
    const project = this.props.project;

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
          rules: data.rules,
        });
      },
      error: error => {
        this.setState({
          owners: [],
        });
      },
    });
  },

  assign(actor) {
    if (actor.id === undefined) {
      return;
    }

    if (actor.type === 'user') {
      assignToUser({id: this.props.event.groupID, user: actor});
    }

    if (actor.type === 'team') {
      assignToActor({id: this.props.event.groupID, actor});
    }
  },

  /**
   * Combine the commiter and ownership data into a single array, merging
   * users who are both owners based on having commits, and owners matching
   * project ownership rules into one array.
   *
   * The return array will include objects of the format:
   *
   * {
   *   actor: <
   *    type,              # Either user or team
   *    SentryTypes.User,  # API expanded user object
   *    {email, id, name}  # Sentry user which is *not* expanded
   *    {email, name}      # Unidentified user (from commits)
   *    {id, name},        # Sentry team (check `type`)
   *   >,
   *
   *   # One or both of commits and rules will be present
   *
   *   commits: [...]  # List of commits made by this owner
   *   rules:   [...]  # Project rules matched for this owner
   * }
   */
  getOwnerList() {
    const owners = this.state.committers.map(commiter => ({
      actor: {type: 'user', ...commiter.author},
      commits: commiter.commits,
    }));

    this.state.owners.forEach(owner => {
      const normalizedOwner = {
        actor: owner,
        rules: findMatchedRules(this.state.rules || [], owner),
      };

      const existingIdx = owners.findIndex(o => o.actor.email === owner.email);
      if (existingIdx > -1) {
        owners[existingIdx] = {...normalizedOwner, ...owners[existingIdx]};
      } else {
        owners.push(normalizedOwner);
      }
    });

    return owners;
  },

  render() {
    const {group, project} = this.props;
    const owners = this.getOwnerList();
    const org = this.getOrganization();

    return (
      <React.Fragment>
        {owners.length > 0 && (
          <div className="m-b-1">
            <h6>
              <span>{t('Suggested Assignees')}</span>
              <small style={{background: '#FFFFFF'}}>{t('Click to assign')}</small>
            </h6>

            <div className="avatar-grid">
              {owners.map((owner, i) => (
                <SuggestedOwnerHovercard
                  key={`${owner.actor.id}:${owner.actor.email}:${owner.actor.name}:${i}`}
                  actor={owner.actor}
                  rules={owner.rules}
                  commits={owner.commits}
                  containerClassName="avatar-grid-item"
                >
                  <span onClick={() => this.assign(owner.actor)}>
                    <ActorAvatar
                      style={{cursor: 'pointer'}}
                      hasTooltip={false}
                      actor={owner.actor}
                    />
                  </span>
                </SuggestedOwnerHovercard>
              ))}
            </div>
          </div>
        )}
        <Access access={['project:write']}>
          <div className="m-b-1">
            <h6>
              <GuideAnchor target="owners" type="text" />
              <span>{t('Ownership Rules')}</span>
            </h6>
            <Button
              onClick={() =>
                openCreateOwnershipRule({
                  project,
                  organization: org,
                  issueId: group.id,
                })}
              size="small"
              className="btn btn-default btn-sm btn-create-ownership-rule"
            >
              {t('Create Ownership Rule')}
            </Button>
          </div>
        </Access>
      </React.Fragment>
    );
  },
});
export default SuggestedOwners;

/**
 * Given a list of rule objects returned from the API, locate the matching
 * rules for a specific owner.
 */
function findMatchedRules(rules, owner) {
  const matchOwner = (actorType, key) =>
    (actorType == 'user' && key === owner.email) ||
    (actorType == 'team' && key == owner.name);

  const actorHasOwner = ([actorType, key]) =>
    actorType === owner.type && matchOwner(actorType, key);

  return rules
    .filter(([_, ruleActors]) => ruleActors.find(actorHasOwner))
    .map(([rule]) => rule);
}
