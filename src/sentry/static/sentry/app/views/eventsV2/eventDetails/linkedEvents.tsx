import React from 'react';
import styled from 'react-emotion';
import get from 'lodash/get';
import moment from 'moment';

import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {Organization, Event, Project} from 'app/types';
import AsyncComponent from 'app/components/asyncComponent';
import DateTime from 'app/components/dateTime';
import Link from 'app/components/links/link';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import {t} from 'app/locale';
import space from 'app/styles/space';
import theme from 'app/utils/theme';
import withProjects from 'app/utils/withProjects';

import {generateEventDetailsRoute, generateEventSlug} from './utils';
import {SectionHeading} from '../styles';
import EventView from '../eventView';

type DiscoverResult = {
  id: string;
  'project.name': string;
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
  eventView: EventView;
} & AsyncComponent['props'];

type State = {
  linkedEvents: {data: DiscoverResult[]};
} & AsyncComponent['state'];

class LinkedEvents extends AsyncComponent<Props, State> {
  getEndpoints(): [string, string, any][] {
    const {event, organization} = this.props;
    const endpoints: any = [];

    const trace = event.tags.find(tag => tag.key === 'trace');
    if (trace) {
      const {start, end} = getParams({
        start: moment
          .unix(get(event, 'startTimestamp', 0))
          .subtract(12, 'hours')
          .format('YYYY-MM-DDTHH:mm:ss.SSS'),
        end: moment
          .unix(get(event, 'endTimestamp', 0))
          .add(12, 'hours')
          .format('YYYY-MM-DDTHH:mm:ss.SSS'),
      });

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
              'event.type',
              'timestamp',
            ],
            sort: ['-timestamp'],
            query: `trace:${trace.value}`,
            start,
            end,
          },
        },
      ]);
    }
    return endpoints;
  }

  renderBody() {
    const {event, organization, projects, eventView} = this.props;
    const {linkedEvents} = this.state;

    const hasLinkedEvents =
      linkedEvents && linkedEvents.data && linkedEvents.data.length >= 1;

    return (
      <Section>
        <SectionHeading>{t('Linked Trace Events')}</SectionHeading>
        {!hasLinkedEvents ? (
          <StyledCard>{t('No linked events found.')}</StyledCard>
        ) : (
          linkedEvents.data.map((item: DiscoverResult) => {
            const eventSlug = generateEventSlug(item);
            const eventUrl = {
              pathname: generateEventDetailsRoute({
                eventSlug,
                orgSlug: organization.slug,
              }),
              query: eventView.generateQueryStringObject(),
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

export default withProjects(LinkedEvents);
