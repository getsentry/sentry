import PropTypes from 'prop-types';
import React from 'react';

import {assignToUser, assignToActor} from 'app/actionCreators/group';
import {openCreateOwnershipRule} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import Access from 'app/components/acl/access';
import ActorAvatar from 'app/components/avatar/actorAvatar';
import Button from 'app/components/button';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import SentryTypes from 'app/sentryTypes';
import SuggestedOwnerHovercard from 'app/components/group/suggestedOwnerHovercard';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

class SuggestedOwners extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
    group: SentryTypes.Group,
    event: SentryTypes.Event,
  };

  constructor(props) {
    super(props);
    this.state = {
      rules: null,
      owners: [],
      committers: [],
    };
  }

  componentDidMount() {
    this.fetchData(this.props.event);
  }

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
  }

  fetchData(event) {
    if (!event) {
      return;
    }

    const {api, project, group, organization} = this.props;

    // No committers if you don't have any releases
    if (!!group.firstRelease) {
      // TODO: move this into a store since `EventCause` makes this exact request as well
      api.request(
        `/projects/${organization.slug}/${project.slug}/events/${event.id}/committers/`,
        {
          success: data => {
            this.setState({
              committers: data.committers,
            });
          },
          error: () => {
            this.setState({
              committers: [],
            });
          },
        }
      );
    }

    api.request(
      `/projects/${organization.slug}/${project.slug}/events/${event.id}/owners/`,
      {
        success: data => {
          this.setState({
            owners: data.owners,
            rules: data.rules,
          });
        },
        error: () => {
          this.setState({
            owners: [],
          });
        },
      }
    );
  }

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
  }

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
  }

  render() {
    const {group, organization, project} = this.props;
    const owners = this.getOwnerList();

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
            <GuideAnchor target="owners">
              <h6>
                <span>{t('Ownership Rules')}</span>
              </h6>
            </GuideAnchor>
            <Button
              onClick={() =>
                openCreateOwnershipRule({
                  project,
                  organization,
                  issueId: group.id,
                })
              }
              size="small"
              className="btn btn-default btn-sm btn-create-ownership-rule"
            >
              {t('Create Ownership Rule')}
            </Button>
          </div>
        </Access>
      </React.Fragment>
    );
  }
}
export {SuggestedOwners};
export default withApi(withOrganization(SuggestedOwners));

/**
 * Given a list of rule objects returned from the API, locate the matching
 * rules for a specific owner.
 */
function findMatchedRules(rules, owner) {
  const matchOwner = (actorType, key) =>
    (actorType === 'user' && key === owner.email) ||
    (actorType === 'team' && key === owner.name);

  const actorHasOwner = ([actorType, key]) =>
    actorType === owner.type && matchOwner(actorType, key);

  return rules
    .filter(([_, ruleActors]) => ruleActors.find(actorHasOwner))
    .map(([rule]) => rule);
}
