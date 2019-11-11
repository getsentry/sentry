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
import {EventViewv1, Organization} from 'app/types';
import Duration from 'app/components/duration';

import {QueryLink} from './styles';

export const MODAL_QUERY_KEYS = ['eventSlug'] as const;
export const PIN_ICON = `image://${pinIcon}`;
export const AGGREGATE_ALIASES = ['p95', 'p75', 'last_seen', 'latest_event'] as const;

export const DEFAULT_EVENT_VIEW_V1: Readonly<EventViewv1> = {
  name: t('All Events'),
  data: {
    fields: ['title', 'event.type', 'project', 'user', 'timestamp'],
    fieldnames: ['title', 'type', 'project', 'user', 'time'],
    sort: ['-timestamp'],
  },
  tags: ['event.type', 'release', 'project.name', 'user.email', 'user.ip', 'environment'],
};

export const TRANSACTION_VIEWS: Readonly<Array<EventViewv1>> = [
  {
    name: t('Transactions'),
    data: {
      fields: [
        'transaction',
        'project',
        'count(id)',
        'avg(transaction.duration)',
        'p75',
        'p95',
      ],
      fieldnames: ['transaction', 'project', '# of events', 'avg', '75th', '95th'],
      sort: ['-count_id'],
      query: 'event.type:transaction',
    },
    tags: ['release', 'project.name', 'user.email', 'user.ip', 'environment'],
  },
  {
    name: t('Transactions by User'),
    data: {
      fields: [
        'user',
        'count(id)',
        'count_unique(transaction)',
        'avg(transaction.duration)',
        'p75',
        'p95',
      ],
      fieldnames: ['user', '# of events', 'unique transactions', 'avg', '75th', '95th'],
      sort: ['-count_id'],
      query: 'event.type:transaction',
    },
    tags: ['release', 'project.name', 'user.email', 'user.ip', 'environment'],
  },
  {
    name: t('Transactions by Region'),
    data: {
      fields: ['geo.region', 'count(id)', 'avg(transaction.duration)', 'p75', 'p95'],
      fieldnames: ['Region', '# of events', 'avg', '75th', '95th'],
      sort: ['-count_id'],
      query: 'event.type:transaction',
    },
    tags: ['release', 'project.name', 'user.email', 'user.ip', 'environment'],
  },
];

export const ALL_VIEWS: Readonly<Array<EventViewv1>> = [
  DEFAULT_EVENT_VIEW_V1,
  {
    name: t('Project Summary'),
    data: {
      fields: ['project', 'count(id)', 'count_unique(issue.id)'],
      fieldnames: ['project', '# of events', 'unique errors'],
      sort: ['-count_id'],
      query: 'event.type:error',
    },
    tags: ['error.type', 'project.name', 'release', 'environment'],
  },
  {
    name: t('Errors'),
    data: {
      fields: ['title', 'count(id)', 'count_unique(user)', 'project', 'last_seen'],
      fieldnames: ['error', '# of events', 'users', 'project', 'last seen'],
      sort: ['-count_id', '-title'],
      query: 'event.type:error',
    },
    tags: ['project.name', 'release', 'environment'],
  },
  {
    name: t('Errors by URL'),
    data: {
      fields: ['url', 'count(id)', 'count_unique(issue.id)'],
      fieldnames: ['URL', '# of events', 'unique errors'],
      sort: ['-count_id'],
      query: 'event.type:error',
    },
    tags: ['error.type', 'project.name', 'url', 'release', 'environment'],
  },
  {
    name: t('Errors by User'),
    data: {
      fields: ['user', 'count(id)', 'count_unique(issue.id)'],
      fieldnames: ['User', '# of events', 'unique errors'],
      sort: ['-count_id'],
      query: 'event.type:error',
    },
    tags: ['user.id', 'project.name', 'url', 'release', 'environment'],
  },
  {
    name: t('Content Security Policy (CSP)'),
    data: {
      fields: ['title', 'count(id)', 'count_unique(user)', 'project', 'last_seen'],
      fieldnames: ['csp', '# of events', 'users', 'project', 'last seen'],
      sort: ['-count_id', '-title'],
      query: 'event.type:csp',
    },
    tags: [
      'project.name',
      'blocked-uri',
      'browser.name',
      'os.name',
      'effective-directive',
      'release',
      'environment',
    ],
  },
  {
    name: t('Content Security Policy (CSP) Report by Directive'),
    data: {
      fields: ['effective-directive', 'count(id)', 'count_unique(title)'],
      fieldnames: ['directive', '# of events', 'reports'],
      sort: ['-count_id'],
      query: 'event.type:csp',
    },
    tags: [
      'project.name',
      'blocked-uri',
      'browser.name',
      'os.name',
      'release',
      'environment',
    ],
  },
  {
    name: t('Content Security Policy (CSP) Report by Blocked URI'),
    data: {
      fields: ['blocked-uri', 'count(id)'],
      fieldnames: ['URI', '# of events'],
      sort: ['-count_id'],
      query: 'event.type:csp',
    },
    tags: [
      'project.name',
      'blocked-uri',
      'browser.name',
      'os.name',
      'release',
      'environment',
    ],
  },
  {
    name: t('Content Security Policy (CSP) Report by User'),
    data: {
      fields: ['user', 'count(id)', 'count_unique(title)'],
      fieldnames: ['User', '# of events', 'reports'],
      sort: ['-count_id'],
      query: 'event.type:csp',
    },
    tags: [
      'project.name',
      'blocked-uri',
      'browser.name',
      'os.name',
      'release',
      'environment',
    ],
  },
];

// sample queries for the discover banner
export const SAMPLE_VIEWS: Readonly<Array<EventViewv1 & {buttonLabel?: string}>> = [
  {
    name: t('Content Security Policy (CSP) Report by User'),
    buttonLabel: t('CSP Reports by User'),
    data: {
      fields: ['user', 'count(id)', 'count_unique(title)'],
      fieldnames: ['User', '# of events', 'reports'],
      sort: ['-count_id'],
      query: 'event.type:csp',
    },
    tags: [
      'project.name',
      'blocked-uri',
      'browser.name',
      'os.name',
      'release',
      'environment',
    ],
  },
  {
    name: t('Browsers with most bugs'),
    data: {
      fields: ['browser.name', 'count(id)', 'count_unique(issue.id)'],
      fieldnames: ['Browser', '# of events', 'unique errors'],
      sort: ['-count_id'],
      query: 'event.type:error',
    },
    tags: ['error.type', 'project.name', 'url', 'release', 'environment'],
  },
  {
    name: t('Top issues this week'),
    data: {
      fields: ['title', 'issue.id', 'project', 'count(id)', 'count_unique(user)'],
      fieldnames: ['Title', 'issue.id', 'project', '# of events', 'users'],
      sort: ['-count_id'],
      query: 'event.type:error',
    },
    tags: ['project.name', 'release', 'environment'],
    statsPeriod: '7d',
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
  duration: FieldFormatter;
};

export type FieldTypes = keyof FieldFormatters;

const emptyValue = <span>{t('n/a')}</span>;
/**
 * A mapping of field types to their rendering function.
 * This mapping is used when a field is not defined in SPECIAL_FIELDS
 * and the field is not being coerced to a link.
 *
 * This mapping should match the output sentry.utils.snuba:get_json_type
 */
export const FIELD_FORMATTERS: FieldFormatters = {
  boolean: {
    sortField: true,
    renderFunc: (field, data, {location}) => {
      const target = {
        pathname: location.pathname,
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
        {typeof data[field] === 'number' ? <Count value={data[field]} /> : emptyValue}
      </NumberContainer>
    ),
  },
  number: {
    sortField: true,
    renderFunc: (field, data) => (
      <NumberContainer>
        {typeof data[field] === 'number' ? <Count value={data[field]} /> : emptyValue}
      </NumberContainer>
    ),
  },
  date: {
    sortField: true,
    renderFunc: (field, data) => (
      <Container>
        {data[field]
          ? getDynamicText({
              value: <StyledDateTime date={data[field]} />,
              fixed: 'timestamp',
            })
          : emptyValue}
      </Container>
    ),
  },
  string: {
    sortField: true,
    renderFunc: (field, data, {location}) => {
      const target = {
        pathname: location.pathname,
        query: {
          ...location.query,
          query: `${field}:${data[field]}`,
        },
      };
      // Some fields have long arrays in them, only show the tail of the data.
      const value = Array.isArray(data[field]) ? data[field].slice(-1) : data[field];
      return <QueryLink to={target}>{value}</QueryLink>;
    },
  },
  duration: {
    sortField: true,
    renderFunc: (field, data) => (
      <NumberContainer>
        {typeof data[field] === 'number' ? (
          <Duration seconds={data[field] / 1000} fixedDigits={2} abbreviation />
        ) : (
          emptyValue
        )}
      </NumberContainer>
    ),
  },
};

const eventLink = (
  location: Location,
  data: EventData,
  content: string | React.ReactNode
): React.ReactNode => {
  const id = data.id || data.latest_event;
  const target = {
    pathname: location.pathname,
    query: {
      ...location.query,
      eventSlug: `${data['project.name']}:${id}`,
    },
  };
  return <OverflowLink to={target}>{content}</OverflowLink>;
};

type LinkFormatter = (
  field: string,
  data: EventData,
  baggage: RenderFunctionBaggage
) => React.ReactNode;

type LinkFormatters = {
  integer: LinkFormatter;
  number: LinkFormatter;
  date: LinkFormatter;
  string: LinkFormatter;
};

export const LINK_FORMATTERS: LinkFormatters = {
  string: (field, data, {location}) => {
    return <Container>{eventLink(location, data, data[field])}</Container>;
  },
  number: (field, data, {location}) => {
    return (
      <NumberContainer>
        {typeof data[field] === 'number'
          ? eventLink(location, data, <Count value={data[field]} />)
          : emptyValue}
      </NumberContainer>
    );
  },
  integer: (field, data, {location}) => {
    return (
      <NumberContainer>
        {typeof data[field] === 'number'
          ? eventLink(location, data, <Count value={data[field]} />)
          : emptyValue}
      </NumberContainer>
    );
  },
  date: (field, data, {location}) => {
    let content = emptyValue;
    if (data[field]) {
      content = getDynamicText({
        value: <StyledDateTime date={data[field]} />,
        fixed: <span>timestamp</span>,
      });
    }
    return <Container>{eventLink(location, data, content)}</Container>;
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
  'issue.id': SpecialField;
};

/**
 * "Special fields" do not map 1:1 to an single column in the event database,
 * they are a UI concept that combines the results of multiple fields and
 * displays with a custom render function.
 */
export const SPECIAL_FIELDS: SpecialFields = {
  'issue.id': {
    sortField: 'issue.id',
    renderFunc: (data, {organization}) => {
      const target = `/organizations/${organization.slug}/issues/${data['issue.id']}/`;
      return (
        <Container>
          <OverflowLink to={target} aria-label={data['issue.id']}>
            {data['issue.id']}
          </OverflowLink>
        </Container>
      );
    },
  },
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
          <OverflowLink to={target} aria-label={data.transaction}>
            {data.transaction}
          </OverflowLink>
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
          <OverflowLink to={target} aria-label={data.title}>
            {data.title}
          </OverflowLink>
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
        <UserBadge useLink={false} user={userObj} hideEmail avatarSize={16} />
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
          {data.last_seen
            ? getDynamicText({
                value: <StyledDateTime date={data.last_seen} />,
                fixed: 'time',
              })
            : emptyValue}
        </Container>
      );
    },
  },
};

/**
 * List of fields that have links auto-generated
 */
export const AUTOLINK_FIELDS: string[] = ['transaction', 'title'];

const Container = styled('div')`
  ${overflowEllipsis};
`;

const NumberContainer = styled('div')`
  text-align: right;
  ${overflowEllipsis};
`;

const StyledDateTime = styled(DateTime)`
  color: ${p => p.theme.gray2};
  ${overflowEllipsis};
`;

const OverflowLink = styled(Link)`
  ${overflowEllipsis};
`;
