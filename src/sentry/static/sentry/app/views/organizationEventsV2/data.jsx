import React from 'react';
import styled from 'react-emotion';

import {deepFreeze} from 'app/utils';
import {t} from 'app/locale';
import Count from 'app/components/count';
import DateTime from 'app/components/dateTime';
import Link from 'app/components/links/link';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import UserBadge from 'app/components/idBadge/userBadge';
import getDynamicText from 'app/utils/getDynamicText';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import pinIcon from 'app/../images/location-pin.png';
import space from 'app/styles/space';

import {QueryLink} from './styles';

export const MODAL_QUERY_KEYS = ['eventSlug'];
export const PIN_ICON = `image://${pinIcon}`;

export const ALL_VIEWS = deepFreeze([
  {
    id: 'all',
    name: t('All Events'),
    data: {
      fields: ['event', 'type', 'project', 'user', 'time'],
      sort: ['-timestamp', '-id'],
    },
    tags: [
      'event.type',
      'release',
      'project.name',
      'user.email',
      'user.ip',
      'environment',
    ],
    columnWidths: ['3fr', '80px', '1fr', '1fr', '1.5fr'],
  },
  {
    id: 'errors',
    name: t('Errors'),
    data: {
      fields: ['error', 'event_count', 'user_count', 'project', 'last_seen'],
      groupby: ['issue.id', 'project.id'],
      sort: ['-last_seen', '-issue.id'],
      query: 'event.type:error',
    },
    tags: ['error.type', 'project.name'],
    columnWidths: ['3fr', '70px', '70px', '1fr', '1.5fr'],
  },
  {
    id: 'csp',
    name: t('CSP'),
    data: {
      fields: ['csp', 'event_count', 'user_count', 'project', 'last_seen'],
      groupby: ['issue.id', 'project.id'],
      sort: ['-last_seen', '-issue.id'],
      query: 'event.type:csp',
    },
    tags: [
      'project.name',
      'blocked-uri',
      'browser.name',
      'os.name',
      'effective-directive',
    ],
    columnWidths: ['3fr', '70px', '70px', '1fr', '1.5fr'],
  },
  {
    id: 'transactions',
    name: t('Transactions'),
    data: {
      fields: ['transaction', 'project'],
      groupby: ['transaction', 'project.id'],
      sort: ['-transaction'],
      query: 'event.type:transaction',
    },
    tags: [
      'event.type',
      'release',
      'project.name',
      'user.email',
      'user.ip',
      'environment',
    ],
    columnWidths: ['3fr', '2fr'],
  },
]);

/**
 * "Special fields" do not map 1:1 to an single column in the event database,
 * they are a UI concept that combines the results of multiple fields and
 * displays with a custom render function.
 */
export const SPECIAL_FIELDS = {
  transaction: {
    fields: ['project.name', 'transaction', 'latest_event'],
    sortField: 'transaction',
    renderFunc: (data, {organization, location}) => {
      const target = {
        pathname: `/organizations/${organization.slug}/events/`,
        query: {
          ...location.query,
          eventSlug: `${data['project.name']}:${data.latest_event}`,
        },
      };
      return (
        <Container>
          <Link css={overflowEllipsis} to={target} aria-label={data.transaction}>
            {data.transaction}
          </Link>
        </Container>
      );
    },
  },
  event: {
    fields: ['title', 'id', 'project.name'],
    sortField: 'title',
    renderFunc: (data, {organization, location}) => {
      const target = {
        pathname: `/organizations/${organization.slug}/events/`,
        query: {...location.query, eventSlug: `${data['project.name']}:${data.id}`},
      };
      return (
        <Container>
          <Link css={overflowEllipsis} to={target} aria-label={data.title}>
            {data.title}
          </Link>
        </Container>
      );
    },
  },
  type: {
    fields: ['event.type'],
    sortField: 'event.type',
    renderFunc: (data, {location, organization}) => {
      const target = {
        pathname: `/organizations/${organization.slug}/events/`,
        query: {
          ...location.query,
          query: `event.type:${data['event.type']}`,
        },
      };

      return <QueryLink to={target}>{data['event.type']}</QueryLink>;
    },
  },
  project: {
    fields: ['project.name'],
    sortField: false,
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
    fields: ['user', 'user.name', 'user.username', 'user.email', 'user.ip', 'user.id'],
    sortField: 'user',
    renderFunc: (data, {organization, location}) => {
      const userObj = {
        id: data['user.id'],
        name: data['user.name'],
        email: data['user.email'],
        username: data['user.username'],
        ip_address: data['user.ip'],
      };

      const badge = (
        <UserBadge useLink={false} user={userObj} hideEmail={true} avatarSize={16} />
      );

      if (!data.user) {
        return <Container>{badge}</Container>;
      }

      const target = {
        pathname: `/organizations/${organization.slug}/events/`,
        query: {
          ...location.query,
          query: `user:${data.user}`,
        },
      };

      return <QueryLink to={target}>{badge}</QueryLink>;
    },
  },
  time: {
    fields: ['timestamp'],
    sortField: 'timestamp',
    renderFunc: data => (
      <Container>
        {data.timestamp
          ? getDynamicText({
              value: <StyledDateTime date={data.timestamp} />,
              fixed: 'time',
            })
          : null}
      </Container>
    ),
  },
  error: {
    fields: ['issue_title', 'project.name', 'latest_event'],
    sortField: 'issue_title',
    renderFunc: (data, {organization, location}) => {
      const target = {
        pathname: `/organizations/${organization.slug}/events/`,
        query: {
          ...location.query,
          eventSlug: `${data['project.name']}:${data.latest_event}`,
        },
      };
      return (
        <Container>
          <Link css={overflowEllipsis} to={target} aria-label={data.issue_title}>
            {data.issue_title}
          </Link>
        </Container>
      );
    },
  },
  csp: {
    fields: ['issue_title', 'project.name', 'latest_event'],
    sortField: 'issue_title',
    renderFunc: (data, {organization, location}) => {
      const target = {
        pathname: `/organizations/${organization.slug}/events/`,
        query: {
          ...location.query,
          eventSlug: `${data['project.name']}:${data.latest_event}`,
        },
      };
      return (
        <Container>
          <Link css={overflowEllipsis} to={target} aria-label={data.issue_title}>
            {data.issue_title}
          </Link>
        </Container>
      );
    },
  },
  event_count: {
    title: 'events',
    fields: ['event_count'],
    sortField: 'event_count',
    renderFunc: data => (
      <NumberContainer>
        {typeof data.event_count === 'number' ? <Count value={data.event_count} /> : null}
      </NumberContainer>
    ),
  },
  user_count: {
    title: 'users',
    fields: ['user_count'],
    sortField: 'user_count',
    renderFunc: data => (
      <NumberContainer>
        {typeof data.user_count === 'number' ? <Count value={data.user_count} /> : null}
      </NumberContainer>
    ),
  },
  last_seen: {
    title: 'last seen',
    fields: ['last_seen'],
    sortField: 'last_seen',
    renderFunc: data => {
      return (
        <Container>
          {data.last_seen ? (
            getDynamicText({
              value: <StyledDateTime date={data.last_seen} />,
              fixed: 'time',
            })
          ) : (
            <span>n/a</span>
          )}
        </Container>
      );
    },
  },
};

const Container = styled('div')`
  padding: ${space(1)};
  ${overflowEllipsis};
`;

const NumberContainer = styled('div')`
  padding: ${space(1)};
  text-align: right;
  ${overflowEllipsis};
`;

const StyledDateTime = styled(DateTime)`
  color: ${p => p.theme.gray2};
  ${overflowEllipsis};
`;
