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
import theme from 'app/utils/theme';
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
  linkedEvents: {data: DiscoverResult[]};
} & AsyncComponent['state'];

class LinkedItems extends AsyncComponent<Props, State> {
  getEndpoints(): [string, string, any][] {
    const {event, organization} = this.props;
    const endpoints: any = [];

    if (event.type !== 'transaction') {
      endpoints.push(['issue', `/issues/${event.groupID}/`, {}]);
    }

    const trace = event.tags.find(tag => tag.key === 'trace');
    if (trace) {
      endpoints.push([
        'linkedEvents',
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

  renderLinkedIssue() {
    const {event} = this.props;
    const {issue} = this.state;
    const issueUrl = `${issue.permalink}events/${event.eventID}/`;

    return (
      <Section>
        <SectionHeading>{t('Linked Issue')}</SectionHeading>
        <StyledCard>
          <StyledLink to={issueUrl} data-test-id="linked-issue">
            <StyledShortId
              shortId={issue.shortId}
              avatar={<ProjectBadge project={issue.project} avatarSize={16} hideName />}
            />
            <div>{issue.title}</div>
          </StyledLink>
          <StyledDate>
            <Times lastSeen={issue.lastSeen} firstSeen={issue.firstSeen} />
          </StyledDate>
        </StyledCard>
      </Section>
    );
  }

  renderLinkedEvents() {
    const {event, organization, projects} = this.props;
    const {linkedEvents} = this.state;
    return (
      <Section>
        <SectionHeading>{t('Linked Trace Events')}</SectionHeading>
        {linkedEvents.data.length < 1 ? (
          <StyledCard>{t('No linked events found.')}</StyledCard>
        ) : (
          linkedEvents.data.map((item: DiscoverResult) => {
            const eventSlug = generateEventSlug(item);
            const eventUrl = {
              pathname: generateEventDetailsRoute({eventSlug, organization}),
              query: location.search,
            };
            const project = projects.find(p => p.slug === item['project.name']);

            return (
              <StyledCard key={item.id} isCurrent={event.id === item.id}>
                <StyledLink to={eventUrl} data-test-id="linked-event">
                  <ProjectBadge project={project} avatarSize={14} />
                  <div>{item.title ? item.title : item.transaction}</div>
                </StyledLink>
                <StyledDate>
                  <DateTime date={item.timestamp} />
                </StyledDate>
              </StyledCard>
            );
          })
        )}
      </Section>
    );
  }

  renderBody() {
    return (
      <React.Fragment>
        {this.state.issue && this.renderLinkedIssue()}
        {this.state.linkedEvents && this.renderLinkedEvents()}
      </React.Fragment>
    );
  }
}

const Section = styled('div')`
  margin-bottom: ${space(2)};
`;

const StyledCard = styled('div')<{isCurrent?: boolean; theme?: any}>`
  display: flex;
  flex-direction: column;
  background: ${p => p.theme.white};
  align-items: center;
  font-size: ${p => p.theme.fontSizeMedium};
  border: 1px solid ${p => (p.isCurrent ? p.theme.purpleLight : p.theme.borderLight)};
  border-radius: ${p => p.theme.borderRadius};
  margin-bottom: ${space(1)};
  padding: ${space(1)} ${space(2)};

  @media (min-width: ${theme.breakpoints[3]}) {
    flex-direction: row;
    justify-content: space-between;
  }
`;

const StyledLink = styled(Link)`
  display: flex;
  flex-direction: column;
  width: 100%;
  overflow-wrap: break-word;

  @media (min-width: ${theme.breakpoints[3]}) {
    flex-direction: row;
    flex-grow: 1;
  }
`;

const StyledDate = styled('div')`
  width: 100%;
  color: ${p => p.theme.gray2};
  font-size: ${p => p.theme.fontSizeSmall};

  @media (min-width: ${theme.breakpoints[3]}) {
    width: auto;
    text-align: right;
    white-space: nowrap;
  }
`;
const StyledShortId = styled(ShortId)`
  justify-content: flex-start;
  color: ${p => p.theme.gray4};

  @media (min-width: ${theme.breakpoints[3]}) {
    margin-right: ${space(2)};
  }
`;

export default withProjects(LinkedItems);
