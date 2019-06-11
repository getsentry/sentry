import React from 'react';
import styled from 'react-emotion';

import {deepFreeze} from 'app/utils';
import DynamicWrapper from 'app/components/dynamicWrapper';
import Link from 'app/components/links/link';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import UserBadge from 'app/components/idBadge/userBadge';
import DateTime from 'app/components/dateTime';

import {QueryLink} from './styles';

export const ALL_VIEWS = deepFreeze([
  {
    id: 'all',
    name: 'All Events',
    data: {
      fields: ['event', 'type', 'project', 'user', 'time'],
      orderby: ['-timestamp', '-id'],
    },
    tags: [
      'event.type',
      'release',
      'project.name',
      'user.email',
      'user.ip',
      'environment',
    ],
  },
  {
    id: 'errors',
    name: 'Errors',
    data: {
      fields: ['error', 'event_count', 'user_count', 'project', 'last_seen'],
      groupby: ['issue.id', 'project.id'],
      orderby: ['-last_seen', '-issue.id'],
    },
    tags: ['error.type', 'project.name'],
  },
  {
    id: 'csp',
    name: 'CSP',
    data: {
      fields: ['csp', 'event_count', 'user_count', 'project', 'last_seen'],
      groupby: ['issue.id', 'project.id'],
      orderby: ['-last_seen', '-issue.id'],
    },
    tags: [
      'project.name',
      'blocked-uri',
      'browser.name',
      'os.name',
      'effective-directive',
    ],
  },
]);

/**
 * "Special fields" do not map 1:1 to an single column in the event database,
 * they are a UI concept that combines the results of multiple fields and
 * displays with a custom render function.
 */
export const SPECIAL_FIELDS = {
  event: {
    fields: ['title', 'id', 'project.name'],
    renderFunc: (data, {organization, location}) => {
      const target = {
        pathname: `/organizations/${organization.slug}/events/`,
        query: {...location.query, eventSlug: `${data['project.name']}:${data.id}`},
      };
      return (
        <Container>
          <Link css={overflowEllipsis} to={target} data-test-id="event-title">
            {data.title}
          </Link>
        </Container>
      );
    },
  },
  type: {
    fields: ['event.type'],
    renderFunc: (data, {onSearch}) => (
      <QueryLink onClick={() => onSearch(`event.type:${data['event.type']}`)}>
        {data['event.type']}
      </QueryLink>
    ),
  },
  project: {
    fields: ['project.name'],
    renderFunc: (data, {organization}) => {
      const project = organization.projects.find(p => p.slug === data['project.name']);
      return (
        <Container>
          {project ? (
            <ProjectBadge project={project} avatarSize={16} />
          ) : (
            data['project.name']
          )}
        </Container>
      );
    },
  },
  user: {
    fields: ['user', 'user.name', 'user.email', 'user.ip'],
    renderFunc: (data, {onSearch}) => {
      const userObj = {
        name: data['user.name'],
        email: data['user.email'],
        ip: data['user.ip'],
      };

      const badge = <UserBadge user={userObj} hideEmail={true} avatarSize={16} />;

      if (!data.user) {
        return <Container>{badge}</Container>;
      }

      return <QueryLink onClick={() => onSearch(`user:${data.user}`)}>{badge}</QueryLink>;
    },
  },
  time: {
    fields: ['timestamp'],
    renderFunc: data => (
      <Container>
        {data.timestamp ? (
          <DynamicWrapper value={<StyledDateTime date={data.timestamp} />} fixed="time" />
        ) : null}
      </Container>
    ),
  },
  error: {
    fields: ['issue_title', 'project.name', 'issue.id'],
    renderFunc: (data, {organization, location}) => {
      const target = {
        pathname: `/organizations/${organization.slug}/events/`,
        query: {
          ...location.query,
          groupSlug: `${data['project.name']}:${data['issue.id']}:latest`,
        },
      };
      return (
        <Container>
          <Link css={overflowEllipsis} to={target} data-test-id="event-title">
            {data.issue_title}
          </Link>
        </Container>
      );
    },
  },
  csp: {
    fields: ['issue_title', 'project.name', 'issue.id'],
    renderFunc: (data, {organization, location}) => {
      const target = {
        pathname: `/organizations/${organization.slug}/events/`,
        query: {
          ...location.query,
          groupSlug: `${data['project.name']}:${data['issue.id']}:latest`,
        },
      };
      return (
        <Container>
          <Link css={overflowEllipsis} to={target} data-test-id="event-title">
            {data.issue_title}
          </Link>
        </Container>
      );
    },
  },
  event_count: {
    title: 'events',
    fields: ['event_count'],
    renderFunc: data => <Container>{data.event_count}</Container>,
  },
  user_count: {
    title: 'users',
    fields: ['user_count'],
    renderFunc: data => <Container>{data.user_count}</Container>,
  },
  last_seen: {
    title: 'last seen',
    fields: ['last_seen'],
    renderFunc: data => (
      <Container>
        <DynamicWrapper value={<StyledDateTime date={data.last_seen} />} fixed="time" />
      </Container>
    ),
  },
};

const Container = styled('div')`
  display: flex;
  padding: ${space(1)};
  ${overflowEllipsis};
`;

const StyledDateTime = styled(DateTime)`
  color: ${p => p.theme.gray2};
  ${overflowEllipsis};
`;
