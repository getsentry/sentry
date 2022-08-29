import {Fragment} from 'react';
import styled from '@emotion/styled';

import AsyncComponent from 'sentry/components/asyncComponent';
import Card from 'sentry/components/card';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import ErrorLevel from 'sentry/components/events/errorLevel';
import EventAnnotation from 'sentry/components/events/eventAnnotation';
import EventEntries from 'sentry/components/events/eventEntries';
import EventMessage from 'sentry/components/events/eventMessage';
import {withMeta} from 'sentry/components/events/meta/metaProxy';
import InboxReason from 'sentry/components/group/inboxBadges/inboxReason';
import UnhandledInboxTag from 'sentry/components/group/inboxBadges/unhandledTag';
import * as Layout from 'sentry/components/layouts/thirds';
import Link from 'sentry/components/links/link';
import space from 'sentry/styles/space';
import {Event, Group, Organization, Project} from 'sentry/types';
import {getMessage} from 'sentry/utils/events';
import GroupActions from 'sentry/views/organizationGroupDetails/actions';
import GroupEventDetails from 'sentry/views/organizationGroupDetails/groupEventDetails/groupEventDetails';
import {TagAndMessageWrapper} from 'sentry/views/organizationGroupDetails/unhandledTag';
import {ReprocessingStatus} from 'sentry/views/organizationGroupDetails/utils';

type Props = {
  event: Event;
  issue: Group;
  organization: Organization;
  project: Project;
} & AsyncComponent['props'];

type State = any;

class IssueSetCarouselItem extends AsyncComponent<Props, State> {
  getEndpoints() {
    return [];
  }

  renderBody() {
    const {event, issue, organization, project, ...props} = this.props;

    const eventWithMeta = withMeta(event);
    const message = getMessage(issue);
    return (
      <StyledCard>
        <IssueHeader>
          <EventOrGroupTitle hasGuideAnchor data={issue} />
        </IssueHeader>
        <StyledTagAndMessageWrapper>
          {issue.level && <ErrorLevel level={issue.level} size="11px" />}
          {issue.isUnhandled && <UnhandledInboxTag />}
          <EventMessage
            message={message}
            annotations={
              <Fragment>
                {issue.logger && (
                  <EventAnnotationWithSpace>
                    <Link
                      to={{
                        pathname: `/organizations/${organization.slug}/issues/`,
                        query: {query: 'logger:' + issue.logger},
                      }}
                    >
                      {issue.logger}
                    </Link>
                  </EventAnnotationWithSpace>
                )}
              </Fragment>
            }
          />
        </StyledTagAndMessageWrapper>
        <GroupActions group={issue} project={project} event={event} disabled={false} />
        {/* <p>{JSON.stringify(event)}</p> */}
        <EventEntries
          group={issue}
          event={eventWithMeta}
          organization={organization}
          project={project}
          {...props}
          showExampleCommit={false}
        />
      </StyledCard>
    );
  }
}

const StyledCard = styled(Card)`
  margin: ${space(2)} 0;
`;

const IssueHeader = styled(Layout.Header)`
  display: flex;
  line-height: 24px;
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: bold;
  /* HACK: Unbold the subtitle */
  em {
    font-weight: normal;
  }
`;

const StyledTagAndMessageWrapper = styled(TagAndMessageWrapper)`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  justify-content: flex-start;
  line-height: 1.2;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    margin-bottom: ${space(2)};
  }
`;

const EventAnnotationWithSpace = styled(EventAnnotation)`
  margin-left: ${space(1)};
`;

export default IssueSetCarouselItem;
