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
      fields: ['event', 'event.type', 'project', 'user', 'time'],
      groupby: [],
      aggregations: [],
      sort: '',
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
      fields: [],
      groupby: ['issue.id'],
      aggregations: [['uniq', 'id', 'event_count'], ['uniq', 'user', 'user_count']],
      sort: '',
    },
    tags: ['error.type', 'project.name'],
  },
  {
    id: 'csp',
    name: 'CSP',
    data: {
      fields: [],
      groupby: ['issue.id'],
      aggregations: [['uniq', 'id', 'event_count'], ['uniq', 'user', 'user_count']],
      sort: '',
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
        <DynamicWrapper value={<StyledDateTime date={data.timestamp} />} fixed="time" />
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
