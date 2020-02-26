import React from 'react';
import {Location} from 'history';

import {t} from 'app/locale';
import Count from 'app/components/count';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import UserBadge from 'app/components/idBadge/userBadge';
import getDynamicText from 'app/utils/getDynamicText';
import pinIcon from 'app/../images/graph/icon-location-filled.svg';
import {Organization, NewQuery} from 'app/types';
import Duration from 'app/components/duration';
import ShortId from 'app/components/shortId';
import floatFormat from 'app/utils/floatFormat';
import Version from 'app/components/version';

import {
  Container,
  NumberContainer,
  OverflowLink,
  StyledDateTime,
  VersionContainer,
} from './styles';

export const PIN_ICON = `image://${pinIcon}`;
export const AGGREGATE_ALIASES = [
  'apdex',
  'impact',
  'p75',
  'p95',
  'p99',
  'last_seen',
  'latest_event',
  'error_rate',
];

// default list of yAxis options
export const CHART_AXIS_OPTIONS = [
  {label: 'count(id)', value: 'count(id)'},
  {label: 'count_unique(users)', value: 'count_unique(user)'},
];

export const DEFAULT_EVENT_VIEW: Readonly<NewQuery> = {
  id: undefined,
  name: t('All Events'),
  query: '',
  projects: [],
  fields: ['title', 'event.type', 'project', 'user', 'timestamp'],
  orderby: '-timestamp',
  version: 2,
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
      'p75()',
      'p95()',
    ],
    orderby: '-count_id',
    query: 'event.type:transaction',
    projects: [],
    version: 2,
    range: '24h',
  },
];

export const ALL_VIEWS: Readonly<Array<NewQuery>> = [
  DEFAULT_EVENT_VIEW,
  {
    id: undefined,
    name: t('Errors by Title'),
    fields: ['title', 'count(id)', 'count_unique(user)', 'project'],
    orderby: '-count_id',
    query: 'event.type:error',
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
    projects: [],
    version: 2,
    range: '24h',
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
    renderFunc: (field, data) => {
      const value = data[field] ? t('yes') : t('no');
      return <Container>{value}</Container>;
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
    renderFunc: (field, data) => {
      // Some fields have long arrays in them, only show the tail of the data.
      const value = Array.isArray(data[field]) ? data[field].slice(-1) : data[field];
      return <Container>{value}</Container>;
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

type SpecialFieldRenderFunc = (
  data: EventData,
  baggage: RenderFunctionBaggage
) => React.ReactNode;

type SpecialField = {
  sortField: string | null;
  renderFunc: SpecialFieldRenderFunc;
};

type SpecialFields = {
  project: SpecialField;
  user: SpecialField;
  last_seen: SpecialField;
  'issue.id': SpecialField;
  issue: SpecialField;
  release: SpecialField;
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
  issue: {
    sortField: null,
    renderFunc: (data, {organization}) => {
      const target = `/organizations/${organization.slug}/issues/${data['issue.id']}/`;
      return (
        <Container>
          <OverflowLink to={target} aria-label={data['issue.id']}>
            <ShortId shortId={`${data.issue}`} />
          </OverflowLink>
        </Container>
      );
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
    renderFunc: data => {
      const userObj = {
        id: data['user.id'],
        name: data['user.name'],
        email: data['user.email'],
        username: data['user.username'],
        ip_address: data['user.ip'],
      };

      const badge = <UserBadge user={userObj} hideEmail avatarSize={16} />;

      return <Container>{badge}</Container>;
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
  release: {
    sortField: 'release',
    renderFunc: data => {
      return (
        data.release && (
          <VersionContainer>
            <Version version={data.release} anchor={false} tooltipRawVersion truncate />
          </VersionContainer>
        )
      );
    },
  },
};
