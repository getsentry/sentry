import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import {bulkUpdate} from 'sentry/actionCreators/group';
import {addLoadingMessage, clearIndicators} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import ErrorLevel from 'sentry/components/events/errorLevel';
import Link from 'sentry/components/links/link';
import PanelItem from 'sentry/components/panels/panelItem';
import {IconChat, IconMute, IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import {space} from 'sentry/styles/space';
import type {BaseGroup} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {getMessage} from 'sentry/utils/events';
import type {Aliases} from 'sentry/utils/theme';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';

type HeaderProps = {
  data: BaseGroup;
  organization: Organization;
  eventId?: string;
};

function CompactIssueHeader({data, organization, eventId}: HeaderProps) {
  const basePath = `/organizations/${organization.slug}/issues/`;

  const issueLink = eventId
    ? `${basePath}${data.id}/events/${eventId}/?referrer=compact-issue`
    : `${basePath}${data.id}/?referrer=compact-issue`;

  const commentColor: keyof Aliases =
    data.subscriptionDetails && data.subscriptionDetails.reason === 'mentioned'
      ? 'success'
      : 'textColor';

  return (
    <Fragment>
      <IssueHeaderMetaWrapper>
        <StyledErrorLevel size={12} level={data.level} />
        <h3 className="truncate">
          <IconLink to={issueLink || ''}>
            {data.status === 'ignored' && <IconMute size="xs" />}
            {data.isBookmarked && <IconStar isSolid size="xs" />}
            <EventOrGroupTitle data={data} />
          </IconLink>
        </h3>
      </IssueHeaderMetaWrapper>
      <div className="event-extra">
        <span className="project-name">
          <strong>{data.project.slug}</strong>
        </span>
        {data.numComments !== 0 && (
          <span>
            <IconLink to={`${basePath}${data.id}/activity/`} className="comments">
              <IconChat size="xs" color={commentColor} />
              <span className="tag-count">{data.numComments}</span>
            </IconLink>
          </span>
        )}
        <span className="culprit">{getMessage(data)}</span>
      </div>
    </Fragment>
  );
}

type GroupTypes = ReturnType<typeof GroupStore.get>;

/**
 * Type assertion to disambiguate GroupTypes
 *
 * The GroupCollapseRelease type isn't compatible with BaseGroup
 */
function isGroup(maybe: GroupTypes): maybe is BaseGroup {
  return (maybe as BaseGroup).status !== undefined;
}

type Props = {
  api: Client;
  id: string;
  organization: Organization;
  children?: React.ReactNode;
  data?: BaseGroup;
  eventId?: string;
};

type State = {
  issue?: GroupTypes;
};

class CompactIssue extends Component<Props, State> {
  state: State = {
    issue: this.props.data || GroupStore.get(this.props.id),
  };

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    if (nextProps.id !== this.props.id) {
      this.setState({
        issue: GroupStore.get(this.props.id),
      });
    }
  }

  componentWillUnmount() {
    this.listener();
  }

  listener = GroupStore.listen(
    (itemIds: Set<string>) => this.onGroupChange(itemIds),
    undefined
  );

  onGroupChange(itemIds: Set<string>) {
    if (!itemIds.has(this.props.id)) {
      return;
    }
    const id = this.props.id;
    const issue = GroupStore.get(id);
    this.setState({
      issue,
    });
  }

  onUpdate(data: Record<string, string>) {
    const issue = this.state.issue;
    if (!issue) {
      return;
    }
    addLoadingMessage(t('Saving changes\u2026'));

    bulkUpdate(
      this.props.api,
      {
        orgId: this.props.organization.slug,
        projectId: issue.project.slug,
        itemIds: [issue.id],
        data,
      },
      {
        complete: () => {
          clearIndicators();
        },
      }
    );
  }

  render() {
    const issue = this.state.issue;
    const {organization} = this.props;
    if (!isGroup(issue)) {
      return null;
    }

    let className = 'issue';
    if (issue.isBookmarked) {
      className += ' isBookmarked';
    }
    if (issue.hasSeen) {
      className += ' hasSeen';
    }
    if (issue.status === 'resolved') {
      className += ' isResolved';
    }
    if (issue.status === 'ignored') {
      className += ' isIgnored';
    }

    return (
      <IssueRow className={className}>
        <CompactIssueHeader
          data={issue}
          organization={organization}
          eventId={this.props.eventId}
        />
        {this.props.children}
      </IssueRow>
    );
  }
}

export default withApi(withOrganization(CompactIssue));

const IssueHeaderMetaWrapper = styled('div')`
  display: flex;
  align-items: center;
`;

const StyledErrorLevel = styled(ErrorLevel)`
  display: block;
  margin-right: ${space(1)};
`;

const IconLink = styled(Link)`
  & > svg {
    margin-right: ${space(0.5)};
  }
`;

const IssueRow = styled(PanelItem)`
  padding-top: ${space(1.5)};
  padding-bottom: ${space(0.75)};
  flex-direction: column;
`;
