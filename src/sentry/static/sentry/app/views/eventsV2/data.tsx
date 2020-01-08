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
import pinIcon from 'app/../images/graph/icon-location-filled.svg';
import {Organization, NewQuery} from 'app/types';
import Duration from 'app/components/duration';
import floatFormat from 'app/utils/floatFormat';

import {QueryLink} from './styles';
import {generateEventDetailsRoute, generateEventSlug} from './eventDetails/utils';

export const PIN_ICON = `image://${pinIcon}`;
export const AGGREGATE_ALIASES = [
  'apdex',
  'impact',
  'p75',
  'p95',
  'p99',
  'last_seen',
  'latest_event',
] as const;

export const DEFAULT_EVENT_VIEW: Readonly<NewQuery> = {
  id: undefined,
  name: t('All Events'),
  query: '',
  projects: [],
  fields: ['title', 'event.type', 'project', 'user', 'timestamp'],
  orderby: '-timestamp',
  version: 2,
  tags: ['event.type', 'release', 'project.name', 'user.email', 'user.ip', 'environment'],
  range: '24h',
};

export const TRANSACTION_VIEWS: Readonly<Array<NewQuery>> = [
  {
    id: undefined,
    name: t('Transactions'),
    fields: [
      'transaction',
      'project',
      'count(id)',
      'avg(transaction.duration)',
      'p75',
      'p95',
    ],
    orderby: '-count_id',
    query: 'event.type:transaction',
    tags: ['release', 'project.name', 'user.email', 'user.ip', 'environment'],
    projects: [],
    version: 2,
    range: '24h',
  },
];

export const ALL_VIEWS: Readonly<Array<NewQuery>> = [
  {
    id: undefined,
    name: t('Errors'),
    fields: ['title', 'count(id)', 'count_unique(user)', 'project', 'last_seen'],
    orderby: '-count_id',
    query: 'event.type:error',
    tags: ['project.name', 'release', 'environment'],
    projects: [],
    version: 2,
    range: '24h',
  },
  {
    id: undefined,
    name: t('Project Summary'),
    fields: ['project', 'count(id)', 'count_unique(issue.id)'],
    orderby: '-count_id',
    query: 'event.type:error',
    tags: ['error.type', 'project.name', 'release', 'environment'],
    projects: [],
    version: 2,
    range: '24h',
  },
  {
    id: undefined,
    name: t('Errors by URL'),
    fields: ['url', 'count(id)', 'count_unique(issue.id)'],
    orderby: '-count_id',
    query: 'event.type:error',
    tags: ['error.type', 'project.name', 'url', 'release', 'environment'],
    projects: [],
    version: 2,
    range: '24h',
  },
  {
    version: 2,
    id: undefined,
    name: t('Errors by Release'),
    fields: ['release', 'count(id)', 'count_unique(user)', 'timestamp'],
    orderby: '-count_id',
    tags: ['event.type', 'release', 'project', 'user.email', 'user.ip', 'environment'],
    projects: [],
    range: '24h',
    environment: [],
    query: '',
  },
];

export type EventData = {[key: string]: any};

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
        {typeof data[field] === 'number' ? floatFormat(data[field], 5) : emptyValue}
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
  organization: Organization,
  data: EventData,
  content: string | React.ReactNode
): React.ReactNode => {
  const eventSlug = generateEventSlug(data);
  const pathname = generateEventDetailsRoute({
    orgSlug: organization.slug,
    eventSlug,
  });

  const target = {
    pathname,
    query: {
      ...location.query,
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
  string: (field, data, {location, organization}) => {
    return <Container>{eventLink(location, organization, data, data[field])}</Container>;
  },
  number: (field, data, {location, organization}) => {
    return (
      <NumberContainer>
        {typeof data[field] === 'number'
          ? eventLink(location, organization, data, <Count value={data[field]} />)
          : emptyValue}
      </NumberContainer>
    );
  },
  integer: (field, data, {location, organization}) => {
    return (
      <NumberContainer>
        {typeof data[field] === 'number'
          ? eventLink(location, organization, data, <Count value={data[field]} />)
          : emptyValue}
      </NumberContainer>
    );
  },
  date: (field, data, {location, organization}) => {
    let content = emptyValue;
    if (data[field]) {
      content = getDynamicText({
        value: <StyledDateTime date={data[field]} />,
        fixed: <span>timestamp</span>,
      });
    }
    return <Container>{eventLink(location, organization, data, content)}</Container>;
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
    renderFunc: (data, {location, organization}) => {
      const eventSlug = generateEventSlug(data);
      const pathname = generateEventDetailsRoute({
        orgSlug: organization.slug,
        eventSlug,
      });

      const target = {
        pathname,
        query: {...location.query},
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
    renderFunc: (data, {location, organization}) => {
      const eventSlug = generateEventSlug(data);
      const pathname = generateEventDetailsRoute({
        orgSlug: organization.slug,
        eventSlug,
      });

      const target = {
        pathname,
        query: {...location.query},
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
