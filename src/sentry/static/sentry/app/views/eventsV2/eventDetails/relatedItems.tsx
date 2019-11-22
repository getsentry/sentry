import React from 'react';
import styled from 'react-emotion';

import {Organization, Event, Group, Project} from 'app/types';
import AsyncComponent from 'app/components/asyncComponent';
import DateTime from 'app/components/dateTime';
import ShortId from 'app/components/shortId';
import Link from 'app/components/links/link';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import Times from 'app/components/group/times';
import {t} from 'app/locale';
import space from 'app/styles/space';
import withProjects from 'app/utils/withProjects';

import {generateEventDetailsRoute, generateEventSlug} from './utils';
import {SectionHeading} from '../styles';

type DiscoverResult = {
  id: string;
  'project.name': string;
  'issue.id': number;
  'event.type': string;
  title: string;
  transaction: string;
  timestamp: number;
};

type Props = {
  organization: Organization;
  projectId: string;
  projects: Project[];
  event: Event;
} & AsyncComponent['props'];

type State = {
  issue: Group;
  relatedEvents: {data: DiscoverResult[]};
} & AsyncComponent['state'];

class RelatedItems extends AsyncComponent<Props, State> {
  getEndpoints(): [string, string, any][] {
    const {event, organization} = this.props;
    const endpoints: any = [];

    if (event.type !== 'transaction') {
      endpoints.push(['issue', `/issues/${event.groupID}/`, {}]);
    }

    const trace = event.tags.find(tag => tag.key === 'trace');
    if (trace) {
      endpoints.push([
        'relatedEvents',
        `/organizations/${organization.slug}/eventsv2/`,
        {
          query: {
            field: [
              'project.name',
              'title',
              'transaction',
              'id',
              'issue.id',
              'event.type',
              'timestamp',
            ],
            sort: ['-timestamp'],
            query: `trace:${trace.value}`,
          },
        },
      ]);
    }
    return endpoints;
  }

  renderRelatedIssue() {
    const {event} = this.props;
    const {issue} = this.state;
    const issueUrl = `${issue.permalink}events/${event.eventID}/`;

    return (
      <Section>
        <SectionHeading>{t('Related Issue')}</SectionHeading>
        <Card>
          <IconContainer>
            <Link to={issueUrl} data-test-id="linked-issue">
              <ShortId
                shortId={issue.shortId}
                avatar={<ProjectBadge project={issue.project} avatarSize={16} hideName />}
              />
            </Link>
          </IconContainer>
          <StyledLink to={issueUrl}>{issue.title}</StyledLink>
          <TimesContainer>
            <Times lastSeen={issue.lastSeen} firstSeen={issue.firstSeen} />
          </TimesContainer>
        </Card>
      </Section>
    );
  }

  renderRelatedEvents() {
    const {event, organization, projects} = this.props;
    const {relatedEvents} = this.state;
    return (
      <Section>
        <SectionHeading>{t('Related Trace Events')}</SectionHeading>
        {relatedEvents.data.length < 1 ? (
          <Card>{t('No related events found.')}</Card>
        ) : (
          relatedEvents.data.map((item: DiscoverResult) => {
            const eventSlug = generateEventSlug(item);
            const eventUrl = {
              pathname: generateEventDetailsRoute({eventSlug, organization}),
              query: location.search,
            };
            const project = projects.find(p => p.slug === item['project.name']);

            return (
              <Card key={item.id} isCurrent={event.id === item.id}>
                <IconContainer>
                  <StyledProjectBadge project={project} avatarSize={14} />
                </IconContainer>
                <StyledLink to={eventUrl} data-test-id="linked-event">
                  {item.title ? item.title : item.transaction}
                </StyledLink>
                <StyledDateTime date={item.timestamp} />
              </Card>
            );
          })
        )}
      </Section>
    );
  }

  renderBody() {
    return (
      <React.Fragment>
        {this.state.issue && this.renderRelatedIssue()}
        {this.state.relatedEvents && this.renderRelatedEvents()}
      </React.Fragment>
    );
  }
}

const Section = styled('div')`
  margin-bottom: ${space(2)};
`;

const Card = styled('div')<{isCurrent?: boolean; theme?: any}>`
  display: flex;
  background: ${p => p.theme.white};
  flex-direction: row;
  align-items: center;
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 1.4;
  border: 1px solid ${p => (p.isCurrent ? p.theme.purpleLight : p.theme.borderLight)};
  border-radius: ${p => p.theme.borderRadius};
  margin-bottom: ${space(1)};
  padding: ${space(1)};
`;

const StyledLink = styled(Link)`
  flex-grow: 1;
`;

const IconContainer = styled('div')`
  display: flex;
  align-items: center;
  margin-right: ${space(1)};
`;

const StyledProjectBadge = styled(ProjectBadge)`
  display: inline-flex;
`;

const StyledDateTime = styled(DateTime)`
  color: ${p => p.theme.gray2};
`;

const TimesContainer = styled('div')`
  color: ${p => p.theme.gray2};
`;

export default withProjects(RelatedItems);
