import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import styled from '@emotion/styled';

import {PanelItem} from 'app/components/panels';
import {addLoadingMessage, clearIndicators} from 'app/actionCreators/indicator';
import {IconChat, IconCheckmark, IconEllipsis, IconMute, IconStar} from 'app/icons';
import {t} from 'app/locale';
import DropdownLink from 'app/components/dropdownLink';
import ErrorLevel from 'app/components/events/errorLevel';
import GroupChart from 'app/components/stream/groupChart';
import GroupStore from 'app/stores/groupStore';
import Link from 'app/components/links/link';
import SentryTypes from 'app/sentryTypes';
import SnoozeAction from 'app/components/issues/snoozeAction';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import {getMessage} from 'app/utils/events';
import EventOrGroupTitle from 'app/components/eventOrGroupTitle';

class CompactIssueHeader extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    projectId: PropTypes.string,
    eventId: PropTypes.string,
    data: PropTypes.object.isRequired,
  };

  render() {
    const {data, organization, projectId, eventId} = this.props;

    const basePath = `/organizations/${organization.slug}/issues/`;

    const issueLink = eventId
      ? `/organizations/${organization.slug}/projects/${projectId}/events/${eventId}/`
      : `${basePath}${data.id}/`;

    const commentColor =
      data.subscriptionDetails && data.subscriptionDetails.reason === 'mentioned'
        ? 'green400'
        : 'currentColor';

    return (
      <React.Fragment>
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
      </React.Fragment>
    );
  }
}

const CompactIssue = createReactClass({
  displayName: 'CompactIssue',

  propTypes: {
    api: PropTypes.object,
    data: PropTypes.object,
    id: PropTypes.string,
    eventId: PropTypes.string,
    statsPeriod: PropTypes.string,
    showActions: PropTypes.bool,
    organization: SentryTypes.Organization.isRequired,
  },

  mixins: [Reflux.listenTo(GroupStore, 'onGroupChange')],

  getInitialState() {
    return {
      issue: this.props.data || GroupStore.get(this.props.id),
    };
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.id !== this.props.id) {
      this.setState({
        issue: GroupStore.get(this.props.id),
      });
    }
  },

  onGroupChange(itemIds) {
    if (!itemIds.has(this.props.id)) {
      return;
    }
    const id = this.props.id;
    const issue = GroupStore.get(id);
    this.setState({
      issue,
    });
  },

  onSnooze(duration) {
    const data = {
      status: 'ignored',
    };

    if (duration) {
      data.ignoreDuration = duration;
    }

    this.onUpdate(data);
  },

  onUpdate(data) {
    const issue = this.state.issue;
    addLoadingMessage(t('Saving changes\u2026'));

    this.props.api.bulkUpdate(
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
  },

  render() {
    const issue = this.state.issue;
    const {id, organization} = this.props;

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

    if (this.props.statsPeriod) {
      className += ' with-graph';
    }

    return (
      <PanelItem
        className={className}
        onClick={this.toggleSelect}
        flexDirection="column"
        style={{paddingTop: '12px', paddingBottom: '6px'}}
      >
        <CompactIssueHeader
          data={issue}
          organization={organization}
          projectId={issue.project.slug}
          eventId={this.props.eventId}
        />
        {this.props.statsPeriod && (
          <div className="event-graph">
            <GroupChart
              id={id}
              statsPeriod={this.props.statsPeriod}
              data={this.props.data}
            />
          </div>
        )}
        {this.props.showActions && (
          <div className="more-menu-container align-right">
            <DropdownLink
              topLevelClasses="more-menu"
              className="more-menu-toggle"
              caret={false}
              title={<IconEllipsis size="xs" />}
            >
              <li>
                <IconLink
                  onClick={this.onUpdate.bind(this, {
                    status: issue.status !== 'resolved' ? 'resolved' : 'unresolved',
                  })}
                >
                  <IconCheckmark size="xs" />
                </IconLink>
              </li>
              <li>
                <IconLink
                  onClick={this.onUpdate.bind(this, {isBookmarked: !issue.isBookmarked})}
                >
                  <IconStar isSolid size="xs" />
                </IconLink>
              </li>
              <li>
                <SnoozeAction
                  orgId={organization.slug}
                  groupId={id}
                  onSnooze={this.onSnooze}
                />
              </li>
            </DropdownLink>
          </div>
        )}
        {this.props.children}
      </PanelItem>
    );
  },
});

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
