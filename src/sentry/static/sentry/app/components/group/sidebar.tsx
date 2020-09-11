import React from 'react';
import isEqual from 'lodash/isEqual';
import isObject from 'lodash/isObject';
import keyBy from 'lodash/keyBy';
import pickBy from 'lodash/pickBy';

import {Client} from 'app/api';
import {addLoadingMessage, clearIndicators} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import ErrorBoundary from 'app/components/errorBoundary';
import ExternalIssueList from 'app/components/group/externalIssuesList';
import GroupParticipants from 'app/components/group/participants';
import GroupReleaseStats from 'app/components/group/releaseStats';
import GroupTagDistributionMeter from 'app/components/group/tagDistributionMeter';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import LoadingError from 'app/components/loadingError';
import SuggestedOwners from 'app/components/group/suggestedOwners/suggestedOwners';
import withApi from 'app/utils/withApi';
import {
  Event,
  Environment,
  Group,
  Organization,
  Project,
  TagWithTopValues,
} from 'app/types';

type Props = {
  api: Client;
  organization: Organization;
  project: Project;
  group: Group;
  event: Event | null;
  environments: Environment[];
};

type State = {
  environments: Environment[];
  currentRelease?: object | null;
  participants: Group['participants'];
  allEnvironmentsGroupData?: Group;
  tagsWithTopValues?: Record<string, TagWithTopValues>;
  error?: boolean;
};

class GroupSidebar extends React.Component<Props, State> {
  constructor(props) {
    super(props);

    this.state = {
      participants: [],
      environments: props.environments,
    };
  }

  componentDidMount() {
    this.fetchAllEnvironmentsGroupData();
    this.fetchCurrentRelease();
    this.fetchParticipants();
    this.fetchTagData();
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (!isEqual(nextProps.environments, this.props.environments)) {
      this.setState({environments: nextProps.environments}, this.fetchTagData);
    }
  }

  fetchAllEnvironmentsGroupData() {
    const {group, api} = this.props;

    // Fetch group data for all environments since the one passed in props is filtered for the selected environment
    // The charts rely on having all environment data as well as the data for the selected env
    api
      .requestPromise(`/issues/${group.id}/`, {
        method: 'GET',
      })
      .then(data => {
        this.setState({allEnvironmentsGroupData: data});
      })
      .catch(() => this.setState({error: true}));
  }

  fetchCurrentRelease() {
    const {group, api} = this.props;

    api
      .requestPromise(`/issues/${group.id}/current-release/`, {
        method: 'GET',
      })
      .then(data => {
        const {currentRelease} = data;
        this.setState({currentRelease});
      })
      .catch(() => this.setState({error: true}));
  }

  fetchParticipants() {
    const {group, api} = this.props;

    api
      .requestPromise(`/issues/${group.id}/participants/`, {
        method: 'GET',
      })
      .then(data => {
        this.setState({
          participants: data,
          error: false,
        });
      })
      .catch(() => this.setState({error: true}));
  }

  fetchTagData() {
    const {api, group} = this.props;

    // Fetch the top values for the current group's top tags.
    api.request(`/issues/${group.id}/tags/`, {
      query: pickBy({
        key: group.tags.map(data => data.key),
        environment: this.state.environments.map(env => env.name),
      }),
      success: data => {
        this.setState({tagsWithTopValues: keyBy(data, 'key')});
      },
      error: () => this.setState({error: true}),
    });
  }

  toggleSubscription() {
    const {api, group, project, organization} = this.props;
    addLoadingMessage(t('Saving changes\u2026'));

    // Typecasting to make TS happy
    const groupId = Number(group.id);
    if (isNaN(groupId)) {
      this.setState({error: true});
      return;
    }

    api.bulkUpdate(
      {
        orgId: organization.slug,
        projectId: project.slug,
        itemIds: [groupId],
        data: {
          isSubscribed: !group.isSubscribed,
        },
      },
      {
        complete: () => {
          api.request(`/issues/${group.id}/participants/`, {
            success: data => {
              this.setState({
                participants: data,
                error: false,
              });
              clearIndicators();
            },
            error: () => {
              this.setState({error: true});
              clearIndicators();
            },
          });
        },
      }
    );
  }

  renderPluginIssue() {
    const issues: React.ReactNode[] = [];
    (this.props.group.pluginIssues || []).forEach(plugin => {
      const issue = plugin.issue;
      // # TODO(dcramer): remove plugin.title check in Sentry 8.22+
      if (issue) {
        issues.push(
          <dl key={plugin.slug}>
            <dt>{`${plugin.shortName || plugin.name || plugin.title}: `}</dt>
            <dd>
              <a href={issue.url}>
                {isObject(issue.label) ? issue.label.id : issue.label}
              </a>
            </dd>
          </dl>
        );
      }
    });
    if (issues.length) {
      return (
        <div>
          <h6>
            <span>{t('External Issues')}</span>
          </h6>
          {issues}
        </div>
      );
    }
    return null;
  }

  renderParticipantData() {
    const {error, participants = []} = this.state;

    if (error) {
      return (
        <LoadingError
          message={t('There was an error while trying to load participants.')}
        />
      );
    }

    return participants.length !== 0 && <GroupParticipants participants={participants} />;
  }

  render() {
    const {organization, project, environments, group, event} = this.props;
    const {allEnvironmentsGroupData, currentRelease, tagsWithTopValues} = this.state;
    const projectId = project.slug;

    return (
      <div className="group-stats">
        {event && <SuggestedOwners project={project} group={group} event={event} />}
        <GroupReleaseStats
          organization={organization}
          project={project}
          environments={environments}
          allEnvironments={allEnvironmentsGroupData}
          group={group}
          currentRelease={currentRelease}
        />

        {event && (
          <ErrorBoundary mini>
            <ExternalIssueList project={project} group={group} event={event} />
          </ErrorBoundary>
        )}

        {this.renderPluginIssue()}

        <h6>
          <GuideAnchor target="tags" position="bottom">
            <span>{t('Tags')}</span>
          </GuideAnchor>
        </h6>
        {tagsWithTopValues &&
          group.tags.map(tag => {
            const tagWithTopValues = tagsWithTopValues[tag.key];
            const topValues = tagWithTopValues ? tagWithTopValues.topValues : [];
            const topValuesTotal = tagWithTopValues ? tagWithTopValues.totalValues : 0;

            return (
              <GroupTagDistributionMeter
                key={tag.key}
                tag={tag.key}
                totalValues={topValuesTotal}
                topValues={topValues}
                name={tag.name}
                data-test-id="group-tag"
                organization={organization}
                projectId={projectId}
                group={group}
              />
            );
          })}
        {group.tags.length === 0 && (
          <p data-test-id="no-tags">
            {environments.length
              ? t('No tags found in the selected environments')
              : t('No tags found')}
          </p>
        )}

        {this.renderParticipantData()}
      </div>
    );
  }
}

export default withApi(GroupSidebar);
