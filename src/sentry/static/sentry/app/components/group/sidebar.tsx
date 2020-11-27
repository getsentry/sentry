import React from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';
import isObject from 'lodash/isObject';
import keyBy from 'lodash/keyBy';
import pickBy from 'lodash/pickBy';

import {addLoadingMessage, clearIndicators} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import ErrorBoundary from 'app/components/errorBoundary';
import ExternalIssueList from 'app/components/group/externalIssuesList';
import GroupParticipants from 'app/components/group/participants';
import GroupReleaseStats from 'app/components/group/releaseStats';
import SuggestedOwners from 'app/components/group/suggestedOwners/suggestedOwners';
import GroupTagDistributionMeter from 'app/components/group/tagDistributionMeter';
import LoadingError from 'app/components/loadingError';
import Placeholder from 'app/components/placeholder';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {
  Environment,
  Event,
  Group,
  Organization,
  Project,
  TagWithTopValues,
} from 'app/types';
import withApi from 'app/utils/withApi';

import SidebarSection from './sidebarSection';

type Props = {
  api: Client;
  organization: Organization;
  project: Project;
  group: Group;
  event: Event | null;
  environments: Environment[];
  className?: string;
};

type State = {
  environments: Environment[];
  participants: Group['participants'];
  allEnvironmentsGroupData?: Group;
  tagsWithTopValues?: Record<string, TagWithTopValues>;
  error?: boolean;
};

class GroupSidebar extends React.Component<Props, State> {
  state: State = {
    participants: [],
    environments: this.props.environments,
  };

  async componentDidMount() {
    const {group, api} = this.props;

    this.fetchParticipants();
    this.fetchTagData();

    try {
      const allEnvironmentsGroupData = await api.requestPromise(`/issues/${group.id}/`);
      // eslint-disable-next-line react/no-did-mount-set-state
      this.setState({
        allEnvironmentsGroupData,
      });
    } catch {
      // eslint-disable-next-line react/no-did-mount-set-state
      this.setState({
        error: true,
      });
    }
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    if (!isEqual(nextProps.environments, this.props.environments)) {
      this.setState({environments: nextProps.environments}, this.fetchTagData);
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
        complete: async () => {
          await this.fetchParticipants();
          clearIndicators();
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
          <React.Fragment key={plugin.slug}>
            <span>{`${plugin.shortName || plugin.name || plugin.title}: `}</span>
            <a href={issue.url}>{isObject(issue.label) ? issue.label.id : issue.label}</a>
          </React.Fragment>
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
    const {className, event, group, organization, project, environments} = this.props;
    const {allEnvironmentsGroupData, tagsWithTopValues} = this.state;
    const projectId = project.slug;

    return (
      <div className={className}>
        {event && <SuggestedOwners project={project} group={group} event={event} />}

        <GroupReleaseStats
          organization={organization}
          project={project}
          environments={environments}
          allEnvironments={allEnvironmentsGroupData}
          group={group}
        />

        {event && (
          <ErrorBoundary mini>
            <ExternalIssueList project={project} group={group} event={event} />
          </ErrorBoundary>
        )}

        {this.renderPluginIssue()}

        <SidebarSection
          title={
            <GuideAnchor target="tags" position="bottom">
              {t('Tags')}
            </GuideAnchor>
          }
        >
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
      </div>
    );
  }
}

const TagPlaceholders = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-auto-flow: row;
`;

const StyledGroupSidebar = styled(GroupSidebar)`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const ExternalIssues = styled('div')`
  display: grid;
  grid-template-columns: auto max-content;
  gap: ${space(2)};
`;

export default withApi(StyledGroupSidebar);
