import {Link} from 'react-router';
import omit from 'lodash/omit';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {fetchOrgMembers} from 'app/actionCreators/members';
import {t} from 'app/locale';
import AssigneeSelector from 'app/components/assigneeSelector';
import Count from 'app/components/count';
import EventAnnotation from 'app/components/events/eventAnnotation';
import EventMessage from 'app/components/events/eventMessage';
import EventOrGroupTitle from 'app/components/eventOrGroupTitle';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import ListLink from 'app/components/links/listLink';
import NavTabs from 'app/components/navTabs';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import SeenByList from 'app/components/seenByList';
import SentryTypes from 'app/sentryTypes';
import ShortId from 'app/components/shortId';
import Tooltip from 'app/components/tooltip';
import Badge from 'app/components/badge';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';

import GroupActions from './actions';

class GroupHeader extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    group: SentryTypes.Group.isRequired,
    project: SentryTypes.Project,
  };

  static contextTypes = {
    location: PropTypes.object,
    organization: SentryTypes.Organization,
  };

  state = {memberList: null};

  componentDidMount() {
    const {organization} = this.context;
    const {project} = this.props.group;

    fetchOrgMembers(this.props.api, organization.slug, project.id).then(memberList => {
      const users = memberList.map(member => member.user);
      this.setState({memberList: users});
    });
  }

  getMessage() {
    const data = this.props.group;
    const metadata = data.metadata;
    switch (data.type) {
      case 'error':
        return metadata.value;
      case 'csp':
        return metadata.message;
      default:
        return this.props.group.culprit || '';
    }
  }

  render() {
    const {project, group} = this.props;
    const {organization, location} = this.context;
    const projectFeatures = new Set(project ? project.features : []);
    const organizationFeatures = new Set(organization ? organization.features : []);
    const userCount = group.userCount;

    let className = 'group-detail';

    if (group.isBookmarked) {
      className += ' isBookmarked';
    }
    if (group.hasSeen) {
      className += ' hasSeen';
    }
    if (group.status === 'resolved') {
      className += ' isResolved';
    }

    const {memberList} = this.state;
    const groupId = group.id;
    const orgId = organization.slug;
    const message = this.getMessage();

    const hasSimilarView = projectFeatures.has('similarity-view');
    const hasEventAttachments = organizationFeatures.has('event-attachments');

    const baseUrl = `/organizations/${orgId}/issues/`;

    const searchTermWithoutQuery = omit(location.query, 'query');
    const eventRouteToObject = {
      pathname: `${baseUrl}${groupId}/events/`,
      query: searchTermWithoutQuery,
    };

    return (
      <div className={className}>
        <div className="row">
          <div className="col-sm-7">
            <h3>
              <EventOrGroupTitle hasGuideAnchor data={group} />
            </h3>

            <EventMessage
              message={message}
              level={group.level}
              annotations={
                <React.Fragment>
                  {group.logger && (
                    <EventAnnotationWithSpace>
                      <Link
                        to={{
                          pathname: baseUrl,
                          query: {query: 'logger:' + group.logger},
                        }}
                      >
                        {group.logger}
                      </Link>
                    </EventAnnotationWithSpace>
                  )}
                  {group.annotations.map((annotation, i) => (
                    <EventAnnotationWithSpace
                      key={i}
                      dangerouslySetInnerHTML={{__html: annotation}}
                    />
                  ))}
                </React.Fragment>
              }
            />
          </div>

          <div className="col-sm-5 stats">
            <div className="flex flex-justify-right">
              {group.shortId && (
                <GuideAnchor target="issue_number" position="bottom">
                  <div className="short-id-box count align-right">
                    <h6 className="nav-header">
                      <Tooltip
                        title={t(
                          'This identifier is unique across your organization, and can be used to reference an issue in various places, like commit messages.'
                        )}
                        position="bottom"
                      >
                        <a
                          className="help-link"
                          href="https://docs.sentry.io/learn/releases/#resolving-issues-via-commits"
                        >
                          {t('Issue #')}
                        </a>
                      </Tooltip>
                    </h6>
                    <ShortId
                      shortId={group.shortId}
                      avatar={
                        <StyledProjectBadge project={project} avatarSize={20} hideName />
                      }
                    />
                  </div>
                </GuideAnchor>
              )}
              <div className="count align-right m-l-1">
                <h6 className="nav-header">{t('Events')}</h6>
                <Link to={eventRouteToObject}>
                  <Count className="count" value={group.count} />
                </Link>
              </div>
              <div className="count align-right m-l-1">
                <h6 className="nav-header">{t('Users')}</h6>
                {userCount !== 0 ? (
                  <Link to={`${baseUrl}${groupId}/tags/user/${location.search}`}>
                    <Count className="count" value={userCount} />
                  </Link>
                ) : (
                  <span>0</span>
                )}
              </div>
              <div className="assigned-to m-l-1">
                <h6 className="nav-header">{t('Assignee')}</h6>
                <AssigneeSelector id={group.id} memberList={memberList} />
              </div>
            </div>
          </div>
        </div>
        <SeenByList
          seenBy={group.seenBy}
          iconTooltip={t('People who have viewed this issue')}
        />
        <GroupActions group={group} project={project} />
        <NavTabs>
          <ListLink
            to={`${baseUrl}${groupId}/${location.search}`}
            isActive={() => {
              const rootGroupPath = `${baseUrl}${groupId}/`;
              const pathname = location.pathname;

              // Because react-router 1.0 removes router.isActive(route)
              return pathname === rootGroupPath || /events\/\w+\/$/.test(pathname);
            }}
          >
            {t('Details')}
          </ListLink>
          <ListLink
            to={`${baseUrl}${groupId}/activity/${location.search}`}
            isActive={() => location.pathname.includes('/activity/')}
          >
            {t('Comments')} <Badge text={group.numComments} />
          </ListLink>
          <ListLink
            to={`${baseUrl}${groupId}/feedback/${location.search}`}
            isActive={() => location.pathname.includes('/feedback/')}
          >
            {t('User Feedback')} <Badge text={group.userReportCount} />
          </ListLink>
          {hasEventAttachments && (
            <ListLink
              to={`${baseUrl}${groupId}/attachments/${location.search}`}
              isActive={() => location.pathname.includes('/attachments/')}
            >
              {t('Attachments')}
            </ListLink>
          )}
          <ListLink
            to={`${baseUrl}${groupId}/tags/${location.search}`}
            isActive={() => location.pathname.includes('/tags/')}
          >
            {t('Tags')}
          </ListLink>
          <ListLink
            to={eventRouteToObject}
            isActive={() => location.pathname.endsWith('/events/')}
          >
            {t('Events')}
          </ListLink>
          <ListLink
            to={`${baseUrl}${groupId}/merged/${location.search}`}
            isActive={() => location.pathname.includes('/merged/')}
          >
            {t('Merged')}
          </ListLink>
          {hasSimilarView && (
            <ListLink
              to={`${baseUrl}${groupId}/similar/${location.search}`}
              isActive={() => location.pathname.includes('/similar/')}
            >
              {t('Similar Issues')}
            </ListLink>
          )}
        </NavTabs>
      </div>
    );
  }
}

const StyledProjectBadge = styled(ProjectBadge)`
  flex-shrink: 0;
`;

const EventAnnotationWithSpace = styled(EventAnnotation)`
  margin-left: ${space(1)};
`;
export {GroupHeader};

export default withApi(GroupHeader);
