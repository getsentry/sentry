import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import {Flex, Box} from 'grid-emotion';

import ApiMixin from 'app/mixins/apiMixin';
import IndicatorStore from 'app/stores/indicatorStore';
import DropdownLink from 'app/components/dropdownLink';
import SnoozeAction from 'app/components/issues/snoozeAction';
import GroupChart from 'app/components/stream/groupChart';
import GroupStore from 'app/stores/groupStore';
import Link from 'app/components/link';
import ProjectLink from 'app/components/projectLink';
import {t} from 'app/locale';
import {PanelItem} from 'app/components/panels';

class CompactIssueHeader extends React.Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
  };

  getTitle = () => {
    let data = this.props.data;
    let metadata = data.metadata;
    switch (data.type) {
      case 'error':
        return (
          <span>
            <span style={{marginRight: 10}}>{metadata.type}</span>
            <em>{data.culprit}</em>
            <br />
          </span>
        );
      case 'csp':
        return (
          <span>
            <span style={{marginRight: 10}}>{metadata.directive}</span>
            <em>{metadata.uri}</em>
            <br />
          </span>
        );
      case 'default':
        return <span>{metadata.title}</span>;
      default:
        return <span>{data.title}</span>;
    }
  };

  getMessage = () => {
    let data = this.props.data;
    let metadata = data.metadata;
    switch (data.type) {
      case 'error':
        return metadata.value;
      case 'csp':
        return metadata.message;
      default:
        return '';
    }
  };

  render() {
    let {orgId, projectId, data} = this.props;

    let styles = {};
    if (data.subscriptionDetails && data.subscriptionDetails.reason === 'mentioned') {
      styles = {color: '#57be8c'};
    }
    return (
      <React.Fragment>
        <Flex align="center">
          <Box mr={1}>
            <span className="error-level truncate" title={data.level} />
          </Box>
          <h3 className="truncate">
            <ProjectLink to={`/${orgId}/${projectId}/issues/${data.id}/`}>
              <span className="icon icon-soundoff" />
              <span className="icon icon-star-solid" />
              {this.getTitle()}
            </ProjectLink>
          </h3>
        </Flex>
        <div className="event-extra">
          <span className="project-name">
            <ProjectLink to={`/${orgId}/${projectId}/`}>{data.project.slug}</ProjectLink>
          </span>
          {data.numComments !== 0 && (
            <span>
              <Link
                to={`/${orgId}/${projectId}/issues/${data.id}/activity/`}
                className="comments"
              >
                <span className="icon icon-comments" style={styles} />
                <span className="tag-count">{data.numComments}</span>
              </Link>
            </span>
          )}
          <span className="culprit">{this.getMessage()}</span>
        </div>
      </React.Fragment>
    );
  }
}

const CompactIssue = createReactClass({
  displayName: 'CompactIssue',

  propTypes: {
    data: PropTypes.object,
    id: PropTypes.string,
    orgId: PropTypes.string,
    statsPeriod: PropTypes.string,
    showActions: PropTypes.bool,
  },

  mixins: [ApiMixin, Reflux.listenTo(GroupStore, 'onGroupChange')],

  getInitialState() {
    return {
      issue: this.props.data || GroupStore.get(this.props.id),
    };
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.id != this.props.id) {
      this.setState({
        issue: GroupStore.get(this.props.id),
      });
    }
  },

  onGroupChange(itemIds) {
    if (!itemIds.has(this.props.id)) {
      return;
    }
    let id = this.props.id;
    let issue = GroupStore.get(id);
    this.setState({
      issue,
    });
  },

  onSnooze(duration) {
    let data = {
      status: 'ignored',
    };

    if (duration) data.ignoreDuration = duration;

    this.onUpdate(data);
  },

  onUpdate(data) {
    let issue = this.state.issue;
    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));

    this.api.bulkUpdate(
      {
        orgId: this.props.orgId,
        projectId: issue.project.slug,
        itemIds: [issue.id],
        data,
      },
      {
        complete: () => {
          IndicatorStore.remove(loadingIndicator);
        },
      }
    );
  },

  render() {
    let issue = this.state.issue;

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

    className += ' level-' + issue.level;

    if (this.props.statsPeriod) {
      className += ' with-graph';
    }

    let {id, orgId} = this.props;
    let projectId = issue.project.slug;
    let title = <span className="icon-more" />;

    return (
      <PanelItem
        className={className}
        onClick={this.toggleSelect}
        direction="column"
        style={{paddingTop: '12px', paddingBottom: '6px'}}
      >
        <CompactIssueHeader data={issue} orgId={orgId} projectId={projectId} />
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
              title={title}
            >
              <li>
                <a
                  onClick={this.onUpdate.bind(this, {
                    status: issue.status !== 'resolved' ? 'resolved' : 'unresolved',
                  })}
                >
                  <span className="icon-checkmark" />
                </a>
              </li>
              <li>
                <a
                  onClick={this.onUpdate.bind(this, {isBookmarked: !issue.isBookmarked})}
                >
                  <span className="icon-star-solid" />
                </a>
              </li>
              <li>
                <SnoozeAction
                  orgId={orgId}
                  projectId={projectId}
                  groupId={id}
                  onSnooze={this.onSnooze}
                />
              </li>
              {false && (
                <li>
                  <a href="#">
                    <span className="icon-user" />
                  </a>
                </li>
              )}
            </DropdownLink>
          </div>
        )}
        {this.props.children}
      </PanelItem>
    );
  },
});

export default CompactIssue;
