import {useMemo} from 'react';
import styled from '@emotion/styled';
import {omit} from 'lodash';

import FeatureBadge from 'sentry/components/badge/featureBadge';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import EventMessage from 'sentry/components/events/eventMessage';
import * as Layout from 'sentry/components/layouts/thirds';
import {space} from 'sentry/styles/space';
import type {Event, Group, Project} from 'sentry/types';
import {IssueCategory} from 'sentry/types/group';
import {getMessage} from 'sentry/utils/events';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

import GroupActions from './actions/updatedAction';
import {GroupHeaderTabs} from './header';
import {ShortIdBreadcrumb} from './shortIdBreadcrumb';
import {Tab} from './types';
import {ReprocessingStatus} from './utils';

interface GroupHeaderProps {
  baseUrl: string;
  group: Group;
  groupReprocessingStatus: ReprocessingStatus;
  project: Project;
  event?: Event;
}

export default function UpdatedGroupHeader({
  group,
  project,
  baseUrl,
  groupReprocessingStatus,
  event,
}: GroupHeaderProps) {
  const location = useLocation();
  const organization = useOrganization();

  const disabledTabs = useMemo(() => {
    if (groupReprocessingStatus === ReprocessingStatus.REPROCESSING) {
      return [
        Tab.ACTIVITY,
        Tab.USER_FEEDBACK,
        Tab.ATTACHMENTS,
        Tab.EVENTS,
        Tab.MERGED,
        Tab.SIMILAR_ISSUES,
        Tab.TAGS,
      ];
    }

    if (groupReprocessingStatus === ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT) {
      return [
        Tab.DETAILS,
        Tab.ATTACHMENTS,
        Tab.EVENTS,
        Tab.MERGED,
        Tab.SIMILAR_ISSUES,
        Tab.TAGS,
        Tab.USER_FEEDBACK,
      ];
    }

    return [];
  }, [groupReprocessingStatus]);

  const eventRoute = useMemo(() => {
    const searchTermWithoutQuery = omit(location.query, 'query');
    return {
      pathname: `${baseUrl}events/`,
      query: searchTermWithoutQuery,
    };
  }, [location, baseUrl]);

  const disableActions = !!disabledTabs.length;

  let className = 'group-detail';

  if (group.hasSeen) {
    className += ' hasSeen';
  }

  if (group.status === 'resolved') {
    className += ' isResolved';
  }
  const message = getMessage(group);

  const shortIdBreadcrumb = (
    <ShortIdBreadcrumb organization={organization} project={project} group={group} />
  );

  return (
    <Layout.Header>
      <div className={className}>
        <div>
          <Breadcrumbs
            crumbs={[
              {
                label: 'Issues',
                to: {
                  pathname: `/organizations/${organization.slug}/issues/`,
                  // Sanitize sort queries from query
                  query: omit(location.query, 'sort'),
                },
              },
              {label: shortIdBreadcrumb},
            ]}
          />
        </div>
        <div>
          <TitleWrapper>
            <TitleHeading>
              {group.issueCategory === IssueCategory.REPLAY && (
                <StyledFeatureBadge type="new" />
              )}
              <h3>
                <StyledEventOrGroupTitle data={group} />
              </h3>
            </TitleHeading>
            <MessageWrapper>
              <EventMessage
                message={message}
                level={group.level}
                levelIndicatorSize="11px"
                type={group.type}
                showUnhandled={group.isUnhandled}
                hideLevel
              />
            </MessageWrapper>
          </TitleWrapper>
        </div>
        <hr />
        <InfoWrapper isResolved={group.status === 'resolved'}>
          <GroupActions
            group={group}
            project={project}
            disabled={disableActions}
            event={event}
            query={location.query}
          />
        </InfoWrapper>
        <GroupHeaderTabs {...{baseUrl, disabledTabs, eventRoute, group, project}} />
      </div>
    </Layout.Header>
  );
}

const TitleWrapper = styled('div')`
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    max-width: 65%;
  }
`;

const StyledEventOrGroupTitle = styled(EventOrGroupTitle)`
  font-size: inherit;
`;

const StyledFeatureBadge = styled(FeatureBadge)`
  align-items: flex-start;
`;

const TitleHeading = styled('div')`
  display: flex;
  line-height: 2;
  gap: ${space(1)};
`;

const MessageWrapper = styled('div')``;

const InfoWrapper = styled('div')<{isResolved: boolean}>`
  display: flex;
  justify-content: space-between;
  background-color: ${p =>
    p.isResolved ? p.theme.green400 : p.theme.backgroundSecondary};
`;

{
  // <HeaderRow>
  // <TitleWrapper>
  // <TitleHeading>
  // {group.issueCategory === IssueCategory.REPLAY && (
  //       <StyledFeatureBadge type="new" />
  // )}
  // <h3>
  //       <StyledEventOrGroupTitle data={group} />
  // </h3>
  // <GroupStatusBadge
  //       status={group.status}
  //       substatus={group.substatus}
  //       fontSize="md"
  // />
  // </TitleHeading>
  // <EventMessage
  // message={message}
  // level={group.level}
  // levelIndicatorSize="11px"
  // type={group.type}
  // showUnhandled={group.isUnhandled}
  // />
  // </TitleWrapper>
  // <StatsWrapper>
  // {issueTypeConfig.stats.enabled && (
  // <Fragment>
  //       <GuideAnchor target="issue_header_stats">
  //         <div className="count">
  //           <h6 className="nav-header">{t('Events')}</h6>
  //           <Link disabled={disableActions} to={eventRoute}>
  //             <Count className="count" value={group.count} />
  //           </Link>
  //         </div>
  //       </GuideAnchor>
  //       <div className="count">
  //         <h6 className="nav-header">{t('Users')}</h6>
  //         {userCount !== 0 ? (
  //           <Link
  //             disabled={disableActions}
  //             to={`${baseUrl}tags/user/${location.search}`}
  //           >
  //             <Count className="count" value={userCount} />
  //           </Link>
  //         ) : (
  //           <span>0</span>
  //         )}
  //       </div>
  // </Fragment>
  // )}
  // <PriorityContainer>
  // <h6 className="nav-header">{t('Priority')}</h6>
  // <GroupPriority group={group} />
  // </PriorityContainer>
  // </StatsWrapper>
}
