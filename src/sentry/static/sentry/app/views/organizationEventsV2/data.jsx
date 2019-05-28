import React from 'react';
import styled from 'react-emotion';

import {deepFreeze} from 'app/utils';
import DynamicWrapper from 'app/components/dynamicWrapper';
import Link from 'app/components/links/link';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import {getUtcDateString} from 'app/utils/dates';
import space from 'app/styles/space';

export const ALL_VIEWS = deepFreeze([
  {
    id: 'all',
    name: 'All Events',
    data: {
      query: '',
      fields: ['event', 'event.type', 'project.name', 'user', 'time'],
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
      query: '',
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
      query: '',
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
    renderFunc: (data, org) => (
      <Container>
        <Link
          css={overflowEllipsis}
          to={`/organizations/${org.slug}/projects/${data['project.name']}/events/${
            data.id
          }/`}
        >
          {data.title}
        </Link>
      </Container>
    ),
  },
  user: {
    fields: ['user.email', 'user.ip'],
    renderFunc: data => <Container>{data['user.email'] || data['user.ip']}</Container>,
  },
  time: {
    fields: ['time'],
    renderFunc: data => (
      <Container>
        <DynamicWrapper
          value={<span css={overflowEllipsis}>{getUtcDateString(data)}</span>}
          fixed="time"
        />
      </Container>
    ),
  },
};

const Container = styled('div')`
  padding: ${space(1)};
`;
