import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';
import isObject from 'lodash/isObject';
import keyBy from 'lodash/keyBy';
import pickBy from 'lodash/pickBy';

import {Client} from 'sentry/api';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import ErrorBoundary from 'sentry/components/errorBoundary';
import ExternalIssueList from 'sentry/components/group/externalIssuesList';
import GroupParticipants from 'sentry/components/group/participants';
import GroupReleaseStats from 'sentry/components/group/releaseStats';
import SuggestedOwners from 'sentry/components/group/suggestedOwners/suggestedOwners';
import GroupTagDistributionMeter from 'sentry/components/group/tagDistributionMeter';
import LoadingError from 'sentry/components/loadingError';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {
  CurrentRelease,
  Environment,
  Group,
  Organization,
  Project,
  TagWithTopValues,
} from 'sentry/types';
import {Event} from 'sentry/types/event';
import withApi from 'sentry/utils/withApi';

import SidebarSection from './sidebarSection';

type Props = {
  api: Client;
  environments: Environment[];
  group: Group;
  organization: Organization;
  project: Project;
  event?: Event;
};

type State = {
  environments: Environment[];
  participants: Group['participants'];
  allEnvironmentsGroupData?: Group;
  currentRelease?: CurrentRelease;
  error?: boolean;
  tagsWithTopValues?: Record<string, TagWithTopValues>;
};

class BaseGroupSidebar extends Component<Props, State> {
  state: State = {
    participants: [],
    environments: this.props.environments,
  };

  componentDidMount() {
    this.fetchAllEnvironmentsGroupData();
    this.fetchCurrentRelease();
    this.fetchParticipants();
    this.fetchTagData();
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    if (!isEqual(nextProps.environments, this.props.environments)) {
      this.setState({environments: nextProps.environments}, this.fetchTagData);
    }
  }

  async fetchAllEnvironmentsGroupData() {
    const {group, api} = this.props;

    // Fetch group data for all environments since the one passed in props is filtered for the selected environment
    // The charts rely on having all environment data as well as the data for the selected env
    try {
      const query = {collapse: 'release'};
      const allEnvironmentsGroupData = await api.requestPromise(`/issues/${group.id}/`, {
        query,
      });
      // eslint-disable-next-line react/no-did-mount-set-state
      this.setState({allEnvironmentsGroupData});
    } catch {
      // eslint-disable-next-line react/no-did-mount-set-state
      this.setState({error: true});
    }
  }

  async fetchCurrentRelease() {
    const {group, api} = this.props;

    try {
      const {currentRelease} = await api.requestPromise(
        `/issues/${group.id}/current-release/`
      );
      this.setState({currentRelease});
    } catch {
      this.setState({error: true});
    }
  }

  async fetchParticipants() {
    const {group, api} = this.props;

    try {
      const participants = await api.requestPromise(`/issues/${group.id}/participants/`);
      this.setState({
        participants,
        error: false,
      });
      return participants;
    } catch {
      this.setState({
        error: true,
      });
      return [];
    }
  }

  async fetchTagData() {
    const {api, group} = this.props;

    try {
      // Fetch the top values for the current group's top tags.
      const data = await api.requestPromise(`/issues/${group.id}/tags/`, {
        query: pickBy({
          key: group.tags.map(tag => tag.key),
          environment: this.state.environments.map(env => env.name),
        }),
      });
      this.setState({tagsWithTopValues: keyBy(data, 'key')});
    } catch {
      this.setState({
        tagsWithTopValues: {},
        error: true,
      });
    }
  }

  renderPluginIssue() {
    const issues: React.ReactNode[] = [];
    (this.props.group.pluginIssues || []).forEach(plugin => {
      const issue = plugin.issue;
      // # TODO(dcramer): remove plugin.title check in Sentry 8.22+
      if (issue) {
        issues.push(
          <Fragment key={plugin.slug}>
            <span>{`${plugin.shortName || plugin.name || plugin.title}: `}</span>
            <a href={issue.url}>{isObject(issue.label) ? issue.label.id : issue.label}</a>
          </Fragment>
        );
      }
    });

    if (!issues.length) {
      return null;
    }

    return (
      <SidebarSection title={t('External Issues')}>
        <ExternalIssues>{issues}</ExternalIssues>
      </SidebarSection>
    );
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
    const {event, group, organization, project, environments} = this.props;
    const {allEnvironmentsGroupData, currentRelease, tagsWithTopValues} = this.state;
    const projectId = project.slug;

    return (
      <Container>
        <PageFiltersContainer>
          <EnvironmentPageFilter alignDropdown="right" />
        </PageFiltersContainer>
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

        <SidebarSection title={t('Tags')}>
          {!tagsWithTopValues ? (
            <TagPlaceholders>
              <Placeholder height="40px" />
              <Placeholder height="40px" />
              <Placeholder height="40px" />
              <Placeholder height="40px" />
            </TagPlaceholders>
          ) : (
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
                  organization={organization}
                  projectId={projectId}
                  group={group}
                />
              );
            })
          )}
          {group.tags.length === 0 && (
            <p data-test-id="no-tags">
              {environments.length
                ? t('No tags found in the selected environments')
                : t('No tags found')}
            </p>
          )}
        </SidebarSection>

        {this.renderParticipantData()}
      </Container>
    );
  }
}

const PageFiltersContainer = styled('div')`
  margin-bottom: ${space(2)};
`;

const Container = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const TagPlaceholders = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-auto-flow: row;
`;

const ExternalIssues = styled('div')`
  display: grid;
  grid-template-columns: auto max-content;
  gap: ${space(2)};
`;

const GroupSidebar = withApi(BaseGroupSidebar);

export default GroupSidebar;
