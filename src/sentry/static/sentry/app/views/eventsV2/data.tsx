import React from 'react';
import styled from 'react-emotion';
import {Location} from 'history';

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
import {EventViewv1, Organization} from 'app/types';

import {QueryLink} from './styles';

export const MODAL_QUERY_KEYS = ['eventSlug'] as const;
export const PIN_ICON = `image://${pinIcon}`;
export const AGGREGATE_ALIASES = ['last_seen', 'latest_event'] as const;

export const DEFAULT_EVENT_VIEW_V1: Readonly<EventViewv1> = {
  name: t('All Events'),
  data: {
    fields: ['title', 'event.type', 'project', 'user', 'timestamp'],
    columnNames: ['title', 'type', 'project', 'user', 'time'],
    sort: ['-timestamp'],
  },
  tags: ['event.type', 'release', 'project.name', 'user.email', 'user.ip', 'environment'],
};

export const ALL_VIEWS: Readonly<Array<EventViewv1>> = [
  DEFAULT_EVENT_VIEW_V1,
  {
    name: t('Project Summary'),
    data: {
      fields: ['project', 'count()', 'count_unique(issue.id)'],
      columnNames: ['project', 'events', 'unique errors'],
      sort: ['-count'],
      query: 'event.type:error',
    },
    tags: ['error.type', 'project.name'],
  },
  {
    name: t('Errors'),
    data: {
      fields: ['title', 'count()', 'count_unique(user)', 'project', 'last_seen'],
      columnNames: ['error', 'events', 'users', 'project', 'last seen'],
      sort: ['-count', '-title'],
      query: 'event.type:error',
    },
    tags: ['project.name'],
  },
  {
    name: t('Errors by URL'),
    data: {
      fields: ['url', 'count()', 'count_unique(issue.id)'],
      columnNames: ['URL', 'events', 'unique errors'],
      sort: ['-count'],
      query: 'event.type:error',
    },
    tags: ['error.type', 'project.name', 'url'],
  },
  {
    name: t('Errors by User'),
    data: {
      fields: ['user', 'count()', 'count_unique(issue.id)'],
      columnNames: ['User', 'events', 'unique errors'],
      sort: ['-count'],
      query: 'event.type:error',
    },
    tags: ['user.id', 'project.name', 'url'],
  },
  {
    name: t('CSP'),
    data: {
      fields: ['title', 'count()', 'count_unique(user)', 'project', 'last_seen'],
      columnNames: ['csp', 'events', 'users', 'project', 'last seen'],
      sort: ['-count', '-title'],
      query: 'event.type:csp',
    },
    tags: [
      'project.name',
      'blocked-uri',
      'browser.name',
      'os.name',
      'effective-directive',
    ],
  },
  {
    name: t('CSP Report by Directive'),
    data: {
      fields: ['effective-directive', 'count()', 'count_unique(title)'],
      columnNames: ['directive', 'events', 'reports'],
      sort: ['-count'],
      query: 'event.type:csp',
    },
    tags: ['project.name', 'blocked-uri', 'browser.name', 'os.name'],
  },
  {
    name: t('CSP Report by Blocked URI'),
    data: {
      fields: ['blocked-uri', 'count()'],
      columnNames: ['URI', 'events'],
      sort: ['-count'],
      query: 'event.type:csp',
    },
    tags: ['project.name', 'blocked-uri', 'browser.name', 'os.name'],
  },
  {
    name: t('CSP Report by User'),
    data: {
      fields: ['user', 'count()', 'count_unique(title)'],
      columnNames: ['User', 'events', 'reports'],
      sort: ['-count'],
      query: 'event.type:csp',
    },
    tags: ['project.name', 'blocked-uri', 'browser.name', 'os.name'],
  },
  {
    name: t('Transactions'),
    data: {
      fields: ['transaction', 'project', 'count()'],
      columnNames: ['transaction', 'project', 'volume'],
      sort: ['-count'],
      query: 'event.type:transaction',
    },
    tags: ['release', 'project.name', 'user.email', 'user.ip', 'environment'],
  },
  {
    name: t('Transactions by User'),
    data: {
      fields: ['user', 'count()', 'count_unique(transaction)'],
      columnNames: ['user', 'events', 'unique transactions'],
      sort: ['-count'],
      query: 'event.type:transaction',
    },
    tags: ['release', 'project.name', 'user.email', 'user.ip', 'environment'],
  },
  {
    name: t('Transactions by Region'),
    data: {
      fields: ['geo.region', 'count()'],
      columnNames: ['Region', 'events'],
      sort: ['-count'],
      query: 'event.type:transaction',
    },
    tags: ['release', 'project.name', 'user.email', 'user.ip'],
  },
];

type EventData = {[key: string]: any};

type RenderFunctionBaggage = {
  organization: Organization;
  location: Location;
};

type FieldFormatterRenderFunction = (
  field: string,
  data: EventData,
  baggage: RenderFunctionBaggage
) => React.ReactNode;

export type FieldFormatterRenderFunctionPartial = (
  data: EventData,
  baggage: RenderFunctionBaggage
) => React.ReactNode;

type FieldFormatter = {
  sortField: boolean;
  renderFunc: FieldFormatterRenderFunction;
};

type FieldFormatters = {
  boolean: FieldFormatter;
  integer: FieldFormatter;
  number: FieldFormatter;
  date: FieldFormatter;
  string: FieldFormatter;
};

export type FieldTypes = keyof FieldFormatters;

/**
 * A mapping of field types to their rendering function.
 * This mapping is used when a field is not defined in SPECIAL_FIELDS
 * This mapping should match the output sentry.utils.snuba:get_json_type
 */
export const FIELD_FORMATTERS: FieldFormatters = {
  boolean: {
    sortField: true,
    renderFunc: (field, data, {organization, location}) => {
      const target = {
        pathname: `/organizations/${organization.slug}/events/`,
        query: {
          ...location.query,
          query: `${field}:${data[field]}`,
        },
      };
      const value = data[field] ? t('yes') : t('no');
      return <QueryLink to={target}>{value}</QueryLink>;
    },
  },
  integer: {
    sortField: true,
    renderFunc: (field, data) => (
      <NumberContainer>
        {typeof data[field] === 'number' ? <Count value={data[field]} /> : null}
      </NumberContainer>
    ),
  },
  number: {
    sortField: true,
    renderFunc: (field, data) => (
      <NumberContainer>
        {typeof data[field] === 'number' ? <Count value={data[field]} /> : null}
      </NumberContainer>
    ),
  },
  date: {
    sortField: true,
    renderFunc: (field, data) => (
      <Container>
        {data[field] ? (
          getDynamicText({
            value: <StyledDateTime date={data[field]} />,
            fixed: 'timestamp',
          })
        ) : (
          <span>t('n/a')</span>
        )}
      </Container>
    ),
  },
  string: {
    sortField: true,
    renderFunc: (field, data, {organization, location}) => {
      const target = {
        pathname: `/organizations/${organization.slug}/events/`,
        query: {
          ...location.query,
          query: `${field}:${data[field]}`,
        },
      };
      return <QueryLink to={target}>{data[field]}</QueryLink>;
    },
  },
};

type SpecialFieldRenderFunc = (
  data: EventData,
  baggage: RenderFunctionBaggage
) => React.ReactNode;

type SpecialField = {
  sortField: string | null;
  renderFunc: SpecialFieldRenderFunc;
};

type SpecialFields = {
  transaction: SpecialField;
  title: SpecialField;
  'event.type': SpecialField;
  project: SpecialField;
  user: SpecialField;
  last_seen: SpecialField;
};

/**
 * "Special fields" do not map 1:1 to an single column in the event database,
 * they are a UI concept that combines the results of multiple fields and
 * displays with a custom render function.
 */
export const SPECIAL_FIELDS: SpecialFields = {
  transaction: {
    sortField: 'transaction',
    renderFunc: (data, {location}) => {
      const id = data.id || data.latest_event;
      const target = {
        pathname: location.pathname,
        query: {
          ...location.query,
          eventSlug: `${data['project.name']}:${id}`,
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
  title: {
    sortField: 'title',
    renderFunc: (data, {location}) => {
      const id = data.id || data.latest_event;
      const target = {
        pathname: location.pathname,
        query: {...location.query, eventSlug: `${data['project.name']}:${id}`},
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
  'event.type': {
    sortField: 'event.type',
    renderFunc: (data, {location}) => {
      const target = {
        pathname: location.pathname,
        query: {
          ...location.query,
          query: `event.type:${data['event.type']}`,
        },
      };

      return <QueryLink to={target}>{data['event.type']}</QueryLink>;
    },
  },
  project: {
    sortField: null,
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
    sortField: 'user.id',
    renderFunc: (data, {location}) => {
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
        pathname: location.pathname,
        query: {
          ...location.query,
          query: `user:${data.user}`,
        },
      };

      return <QueryLink to={target}>{badge}</QueryLink>;
    },
  },
  last_seen: {
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
