import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import {bulkUpdate} from 'app/actionCreators/group';
import {addLoadingMessage, clearIndicators} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import EventOrGroupTitle from 'app/components/eventOrGroupTitle';
import ErrorLevel from 'app/components/events/errorLevel';
import Link from 'app/components/links/link';
import {PanelItem} from 'app/components/panels';
import {IconChat, IconMute, IconStar} from 'app/icons';
import {t} from 'app/locale';
import GroupStore from 'app/stores/groupStore';
import space from 'app/styles/space';
import {BaseGroup, LightWeightOrganization} from 'app/types';
import {getMessage} from 'app/utils/events';
import {Aliases} from 'app/utils/theme';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

type HeaderProps = {
  organization: LightWeightOrganization;
  projectId: string;
  data: BaseGroup;
  eventId?: string;
};

class CompactIssueHeader extends Component<HeaderProps> {
  render() {
    const {data, organization, projectId, eventId} = this.props;

    const basePath = `/organizations/${organization.slug}/issues/`;

    const issueLink = eventId
      ? `/organizations/${organization.slug}/projects/${projectId}/events/${eventId}/`
      : `${basePath}${data.id}/`;

    const commentColor: keyof Aliases =
      data.subscriptionDetails && data.subscriptionDetails.reason === 'mentioned'
        ? 'success'
        : 'textColor';

    return (
      <Fragment>
        <IssueHeaderMetaWrapper>
          <StyledErrorLevel size="12px" level={data.level} title={data.level} />
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
  organization: LightWeightOrganization;
  eventId?: string;
  data?: BaseGroup;
};

type State = {
  issue?: GroupTypes;
};

class CompactIssue extends Component<Props, State> {
  state: State = {
    issue: this.props.data || GroupStore.get(this.props.id),
  };

  componentWillReceiveProps(nextProps: Props) {
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
          projectId={issue.project.slug}
          eventId={this.props.eventId}
        />
        {this.props.children}
      </IssueRow>
    );
  }
}

export {CompactIssue};
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
