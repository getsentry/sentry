import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import partial from 'lodash/partial';

import Button from 'sentry/components/button';
import Count from 'sentry/components/count';
import DropdownMenuControl from 'sentry/components/dropdownMenuControl';
import {MenuItemProps} from 'sentry/components/dropdownMenuItem';
import Duration from 'sentry/components/duration';
import FileSize from 'sentry/components/fileSize';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import UserBadge from 'sentry/components/idBadge/userBadge';
import ExternalLink from 'sentry/components/links/externalLink';
import {RowRectangle} from 'sentry/components/performance/waterfall/rowBar';
import {pickBarColor, toPercent} from 'sentry/components/performance/waterfall/utils';
import Tooltip from 'sentry/components/tooltip';
import UserMisery from 'sentry/components/userMisery';
import Version from 'sentry/components/version';
import {IconDownload, IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {AvatarProject, IssueAttachment, Organization, Project} from 'sentry/types';
import {defined, isUrl} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventView, {EventData, MetaType} from 'sentry/utils/discover/eventView';
import {
  AGGREGATIONS,
  getAggregateAlias,
  getSpanOperationName,
  isEquation,
  isRelativeSpanOperationBreakdownField,
  SPAN_OP_BREAKDOWN_FIELDS,
  SPAN_OP_RELATIVE_BREAKDOWN_FIELD,
} from 'sentry/utils/discover/fields';
import {getShortEventId} from 'sentry/utils/events';
import {formatFloat, formatPercentage} from 'sentry/utils/formatters';
import getDynamicText from 'sentry/utils/getDynamicText';
import Projects from 'sentry/utils/projects';
import {
  filterToLocationQuery,
  SpanOperationBreakdownFilter,
  stringToFilter,
} from 'sentry/views/performance/transactionSummary/filter';

import {decodeScalar} from '../queryString';

import ArrayValue from './arrayValue';
import {
  BarContainer,
  Container,
  FieldDateTime,
  FieldShortId,
  FlexContainer,
  NumberContainer,
  OverflowLink,
  UserIcon,
  VersionContainer,
} from './styles';
import TeamKeyTransactionField from './teamKeyTransactionField';

/**
 * Types, functions and definitions for rendering fields in discover results.
 */
export type RenderFunctionBaggage = {
  location: Location;
  organization: Organization;
  eventView?: EventView;
  projectId?: string;
  unit?: string;
};

type RenderFunctionOptions = {
  enableOnClick?: boolean;
};

type FieldFormatterRenderFunction = (
  field: string,
  data: EventData,
  baggage?: RenderFunctionBaggage
) => React.ReactNode;

type FieldFormatterRenderFunctionPartial = (
  data: EventData,
  baggage: RenderFunctionBaggage
) => React.ReactNode;

type FieldFormatter = {
  isSortable: boolean;
  renderFunc: FieldFormatterRenderFunction;
};

type FieldFormatters = {
  array: FieldFormatter;
  boolean: FieldFormatter;
  date: FieldFormatter;
  duration: FieldFormatter;
  integer: FieldFormatter;
  number: FieldFormatter;
  percentage: FieldFormatter;
  size: FieldFormatter;
  string: FieldFormatter;
};

export type FieldTypes = keyof FieldFormatters;

const EmptyValueContainer = styled('span')`
  color: ${p => p.theme.gray300};
`;
const emptyValue = <EmptyValueContainer>{t('(no value)')}</EmptyValueContainer>;
const emptyStringValue = <EmptyValueContainer>{t('(empty string)')}</EmptyValueContainer>;

export function nullableValue(value: string | null): string | React.ReactElement {
  switch (value) {
    case null:
      return emptyValue;
    case '':
      return emptyStringValue;
    default:
      return value;
  }
}

export const SIZE_UNITS = {
  bit: 1 / 8,
  byte: 1,
  kibibyte: 1024,
  mebibyte: 1024 ** 2,
  gibibyte: 1024 ** 3,
  tebibyte: 1024 ** 4,
  pebibyte: 1024 ** 5,
  exbibyte: 1024 ** 6,
  kilobyte: 1000,
  megabyte: 1000 ** 2,
  gigabyte: 1000 ** 3,
  terabyte: 1000 ** 4,
  petabyte: 1000 ** 5,
  exabyte: 1000 ** 6,
};

export const ABYTE_UNITS = [
  'kilobyte',
  'megabyte',
  'gigabyte',
  'terabyte',
  'petabyte',
  'exabyte',
];

export const DURATION_UNITS = {
  nanosecond: 1 / 1000 ** 2,
  microsecond: 1 / 1000,
  millisecond: 1,
  second: 1000,
  minute: 1000 * 60,
  hour: 1000 * 60 * 60,
  day: 1000 * 60 * 60 * 24,
  week: 1000 * 60 * 60 * 24 * 7,
};

export const PERCENTAGE_UNITS = ['ratio', 'percent'];

/**
 * A mapping of field types to their rendering function.
 * This mapping is used when a field is not defined in SPECIAL_FIELDS
 * and the field is not being coerced to a link.
 *
 * This mapping should match the output sentry.utils.snuba:get_json_type
 */
export const FIELD_FORMATTERS: FieldFormatters = {
  boolean: {
    isSortable: true,
    renderFunc: (field, data) => {
      const value = data[field] ? t('true') : t('false');
      return <Container>{value}</Container>;
    },
  },
  date: {
    isSortable: true,
    renderFunc: (field, data, baggage) => (
      <Container>
        {data[field]
          ? getDynamicText({
              value: (
                <FieldDateTime
                  date={data[field]}
                  year
                  seconds
                  timeZone
                  utc={decodeScalar(baggage?.location?.query?.utc) === 'true'}
                />
              ),
              fixed: 'timestamp',
            })
          : emptyValue}
      </Container>
    ),
  },
  duration: {
    isSortable: true,
    renderFunc: (field, data, baggage) => {
      const {unit} = baggage ?? {};
      return (
        <NumberContainer>
          {typeof data[field] === 'number' ? (
            <Duration
              seconds={(data[field] * ((unit && DURATION_UNITS[unit]) ?? 1)) / 1000}
              fixedDigits={2}
              abbreviation
            />
          ) : (
            emptyValue
          )}
        </NumberContainer>
      );
    },
  },
  integer: {
    isSortable: true,
    renderFunc: (field, data) => (
      <NumberContainer>
        {typeof data[field] === 'number' ? <Count value={data[field]} /> : emptyValue}
      </NumberContainer>
    ),
  },
  number: {
    isSortable: true,
    renderFunc: (field, data) => (
      <NumberContainer>
        {typeof data[field] === 'number' ? formatFloat(data[field], 4) : emptyValue}
      </NumberContainer>
    ),
  },
  percentage: {
    isSortable: true,
    renderFunc: (field, data) => (
      <NumberContainer>
        {typeof data[field] === 'number' ? formatPercentage(data[field]) : emptyValue}
      </NumberContainer>
    ),
  },
  size: {
    isSortable: true,
    renderFunc: (field, data, baggage) => {
      const {unit} = baggage ?? {};
      return (
        <NumberContainer>
          {unit && SIZE_UNITS[unit] && typeof data[field] === 'number' ? (
            <FileSize
              bytes={data[field] * SIZE_UNITS[unit]}
              base={ABYTE_UNITS.includes(unit) ? 10 : 2}
            />
          ) : (
            emptyValue
          )}
        </NumberContainer>
      );
    },
  },
  string: {
    isSortable: true,
    renderFunc: (field, data) => {
      // Some fields have long arrays in them, only show the tail of the data.
      const value = Array.isArray(data[field])
        ? data[field].slice(-1)
        : defined(data[field])
        ? data[field]
        : emptyValue;
      if (isUrl(value)) {
        return (
          <Container>
            <ExternalLink href={value} data-test-id="group-tag-url">
              {value}
            </ExternalLink>
          </Container>
        );
      }
      return <Container>{nullableValue(value)}</Container>;
    },
  },
  array: {
    isSortable: true,
    renderFunc: (field, data) => {
      const value = Array.isArray(data[field]) ? data[field] : [data[field]];
      return <ArrayValue value={value} />;
    },
  },
};

type SpecialFieldRenderFunc = (
  data: EventData,
  baggage: RenderFunctionBaggage
) => React.ReactNode;

type SpecialField = {
  renderFunc: SpecialFieldRenderFunc;
  sortField: string | null;
};

type SpecialFields = {
  attachments: SpecialField;
  'count_unique(user)': SpecialField;
  'error.handled': SpecialField;
  id: SpecialField;
  issue: SpecialField;
  'issue.id': SpecialField;
  minidump: SpecialField;
  project: SpecialField;
  release: SpecialField;
  replayId: SpecialField;
  team_key_transaction: SpecialField;
  'timestamp.to_day': SpecialField;
  'timestamp.to_hour': SpecialField;
  trace: SpecialField;
  'trend_percentage()': SpecialField;
  user: SpecialField;
  'user.display': SpecialField;
};

const DownloadCount = styled('span')`
  padding-left: ${space(0.75)};
`;

const RightAlignedContainer = styled('span')`
  margin-left: auto;
  margin-right: 0;
`;

/**
 * "Special fields" either do not map 1:1 to an single column in the event database,
 * or they require custom UI formatting that can't be handled by the datatype formatters.
 */
const SPECIAL_FIELDS: SpecialFields = {
  // This is a custom renderer for a field outside discover
  // TODO - refactor code and remove from this file or add ability to query for attachments in Discover
  attachments: {
    sortField: null,
    renderFunc: (data, {organization, projectId}) => {
      const attachments: Array<IssueAttachment> = data.attachments;

      const items: MenuItemProps[] = attachments
        .filter(attachment => attachment.type !== 'event.minidump')
        .map(attachment => ({
          key: attachment.id,
          label: attachment.name,
          onAction: () =>
            window.open(
              `/api/0/projects/${organization.slug}/${projectId}/events/${attachment.event_id}/attachments/${attachment.id}/?download=1`
            ),
        }));

      return (
        <RightAlignedContainer>
          <DropdownMenuControl
            position="left"
            size="xs"
            triggerProps={{
              showChevron: false,
              icon: (
                <Fragment>
                  <IconDownload color="gray500" size="sm" />
                  <DownloadCount>{items.length}</DownloadCount>
                </Fragment>
              ),
            }}
            items={items}
          />
        </RightAlignedContainer>
      );
    },
  },
  minidump: {
    sortField: null,
    renderFunc: (data, {organization, projectId}) => {
      const attachments: Array<IssueAttachment & {url: string}> = data.attachments;

      const minidump = attachments.find(
        attachment => attachment.type === 'event.minidump'
      );

      return (
        <RightAlignedContainer>
          <Button
            size="xs"
            disabled={!minidump}
            onClick={
              minidump
                ? () => {
                    window.open(
                      `/api/0/projects/${organization.slug}/${projectId}/events/${minidump.event_id}/attachments/${minidump.id}/?download=1`
                    );
                  }
                : undefined
            }
          >
            <IconDownload color="gray500" size="sm" />
            <DownloadCount>{minidump ? 1 : 0}</DownloadCount>
          </Button>
        </RightAlignedContainer>
      );
    },
  },
  id: {
    sortField: 'id',
    renderFunc: data => {
      const id: string | unknown = data?.id;
      if (typeof id !== 'string') {
        return null;
      }

      return <Container>{getShortEventId(id)}</Container>;
    },
  },
  trace: {
    sortField: 'trace',
    renderFunc: data => {
      const id: string | unknown = data?.trace;
      if (typeof id !== 'string') {
        return emptyValue;
      }

      return <Container>{getShortEventId(id)}</Container>;
    },
  },
  'issue.id': {
    sortField: 'issue.id',
    renderFunc: (data, {organization}) => {
      const target = {
        pathname: `/organizations/${organization.slug}/issues/${data['issue.id']}/`,
      };

      return (
        <Container>
          <OverflowLink to={target} aria-label={data['issue.id']}>
            {data['issue.id']}
          </OverflowLink>
        </Container>
      );
    },
  },
  replayId: {
    sortField: 'replayId',
    renderFunc: data => {
      const replayId = data?.replayId;
      if (typeof replayId !== 'string' || !replayId) {
        return emptyValue;
      }

      return (
        <Container>
          <Button size="xs">
            <IconPlay size="xs" />
          </Button>
        </Container>
      );
    },
  },
  issue: {
    sortField: null,
    renderFunc: (data, {organization}) => {
      const issueID = data['issue.id'];

      if (!issueID) {
        return (
          <Container>
            <FieldShortId shortId={`${data.issue}`} />
          </Container>
        );
      }

      const target = {
        pathname: `/organizations/${organization.slug}/issues/${issueID}/`,
      };

      return (
        <Container>
          <OverflowLink to={target} aria-label={issueID}>
            <FieldShortId shortId={`${data.issue}`} />
          </OverflowLink>
        </Container>
      );
    },
  },
  project: {
    sortField: 'project',
    renderFunc: (data, {organization}) => {
      let slugs: string[] | undefined = undefined;
      let projectIds: number[] | undefined = undefined;
      if (typeof data.project === 'number') {
        projectIds = [data.project];
      } else {
        slugs = [data.project];
      }
      return (
        <Container>
          <Projects orgId={organization.slug} slugs={slugs} projectIds={projectIds}>
            {({projects}) => {
              let project: Project | AvatarProject | undefined;
              if (typeof data.project === 'number') {
                project = projects.find(p => p.id === data.project.toString());
              } else {
                project = projects.find(p => p.slug === data.project);
              }
              return (
                <ProjectBadge
                  project={project ? project : {slug: data.project}}
                  avatarSize={16}
                />
              );
            }}
          </Projects>
        </Container>
      );
    },
  },
  user: {
    sortField: 'user',
    renderFunc: data => {
      if (data.user) {
        const [key, value] = data.user.split(':');
        const userObj = {
          id: '',
          name: '',
          email: '',
          username: '',
          ip_address: '',
        };
        userObj[key] = value;

        const badge = <UserBadge user={userObj} hideEmail avatarSize={16} />;
        return <Container>{badge}</Container>;
      }

      return <Container>{emptyValue}</Container>;
    },
  },
  'user.display': {
    sortField: 'user.display',
    renderFunc: data => {
      if (data['user.display']) {
        const userObj = {
          id: '',
          name: data['user.display'],
          email: '',
          username: '',
          ip_address: '',
        };

        const badge = <UserBadge user={userObj} hideEmail avatarSize={16} />;
        return <Container>{badge}</Container>;
      }

      return <Container>{emptyValue}</Container>;
    },
  },
  'count_unique(user)': {
    sortField: 'count_unique(user)',
    renderFunc: data => {
      const count = data.count_unique_user ?? data['count_unique(user)'];
      if (typeof count === 'number') {
        return (
          <FlexContainer>
            <NumberContainer>
              <Count value={count} />
            </NumberContainer>
            <UserIcon size="20" />
          </FlexContainer>
        );
      }

      return <Container>{emptyValue}</Container>;
    },
  },
  release: {
    sortField: 'release',
    renderFunc: data =>
      data.release ? (
        <VersionContainer>
          <Version version={data.release} anchor={false} tooltipRawVersion truncate />
        </VersionContainer>
      ) : (
        <Container>{emptyValue}</Container>
      ),
  },
  'error.handled': {
    sortField: 'error.handled',
    renderFunc: data => {
      const values = data['error.handled'];
      // Transactions will have null, and default events have no handled attributes.
      if (values === null || values?.length === 0) {
        return <Container>{emptyValue}</Container>;
      }
      const value = Array.isArray(values) ? values : [values];
      return (
        <Container>
          {value.every(v => [1, null].includes(v)) ? 'true' : 'false'}
        </Container>
      );
    },
  },
  team_key_transaction: {
    sortField: null,
    renderFunc: (data, {organization}) => (
      <Container>
        <TeamKeyTransactionField
          isKeyTransaction={(data.team_key_transaction ?? 0) !== 0}
          organization={organization}
          projectSlug={data.project}
          transactionName={data.transaction}
        />
      </Container>
    ),
  },
  'trend_percentage()': {
    sortField: 'trend_percentage()',
    renderFunc: data => (
      <NumberContainer>
        {typeof data.trend_percentage === 'number'
          ? formatPercentage(data.trend_percentage - 1)
          : emptyValue}
      </NumberContainer>
    ),
  },
  'timestamp.to_hour': {
    sortField: 'timestamp.to_hour',
    renderFunc: data => (
      <Container>
        {getDynamicText({
          value: <FieldDateTime date={data['timestamp.to_hour']} year timeZone />,
          fixed: 'timestamp.to_hour',
        })}
      </Container>
    ),
  },
  'timestamp.to_day': {
    sortField: 'timestamp.to_day',
    renderFunc: data => (
      <Container>
        {getDynamicText({
          value: <FieldDateTime date={data['timestamp.to_day']} dateOnly year utc />,
          fixed: 'timestamp.to_day',
        })}
      </Container>
    ),
  },
};

type SpecialFunctionFieldRenderer = (
  fieldName: string
) => (data: EventData, baggage: RenderFunctionBaggage) => React.ReactNode;

type SpecialFunctions = {
  user_misery: SpecialFunctionFieldRenderer;
};

/**
 * "Special functions" are functions whose values either do not map 1:1 to a single column,
 * or they require custom UI formatting that can't be handled by the datatype formatters.
 */
const SPECIAL_FUNCTIONS: SpecialFunctions = {
  user_misery: fieldName => data => {
    const userMiseryField = fieldName;

    if (!(userMiseryField in data)) {
      return <NumberContainer>{emptyValue}</NumberContainer>;
    }

    const userMisery = data[userMiseryField];
    if (userMisery === null || isNaN(userMisery)) {
      return <NumberContainer>{emptyValue}</NumberContainer>;
    }

    const projectThresholdConfig = 'project_threshold_config';
    let countMiserableUserField: string = '';

    let miseryLimit: number | undefined = parseInt(
      userMiseryField.split('(').pop()?.slice(0, -1) || '',
      10
    );
    if (isNaN(miseryLimit)) {
      countMiserableUserField = 'count_miserable(user)';
      if (projectThresholdConfig in data) {
        miseryLimit = data[projectThresholdConfig][1];
      } else {
        miseryLimit = undefined;
      }
    } else {
      countMiserableUserField = `count_miserable(user,${miseryLimit})`;
    }

    const uniqueUsers = data['count_unique(user)'];

    let miserableUsers: number | undefined;

    if (countMiserableUserField in data) {
      const countMiserableMiseryLimit = parseInt(
        userMiseryField.split('(').pop()?.slice(0, -1) || '',
        10
      );
      miserableUsers =
        countMiserableMiseryLimit === miseryLimit ||
        (isNaN(countMiserableMiseryLimit) && projectThresholdConfig)
          ? data[countMiserableUserField]
          : undefined;
    }

    return (
      <BarContainer>
        <UserMisery
          bars={10}
          barHeight={20}
          miseryLimit={miseryLimit}
          totalUsers={uniqueUsers}
          userMisery={userMisery}
          miserableUsers={miserableUsers}
        />
      </BarContainer>
    );
  },
};

/**
 * Get the sort field name for a given field if it is special or fallback
 * to the generic type formatter.
 */
export function getSortField(
  field: string,
  tableMeta: MetaType | undefined
): string | null {
  if (SPECIAL_FIELDS.hasOwnProperty(field)) {
    return SPECIAL_FIELDS[field as keyof typeof SPECIAL_FIELDS].sortField;
  }

  if (!tableMeta) {
    return field;
  }

  if (isEquation(field)) {
    return field;
  }

  for (const alias in AGGREGATIONS) {
    if (field.startsWith(alias)) {
      return AGGREGATIONS[alias].isSortable ? field : null;
    }
  }

  const fieldType = tableMeta[field];
  if (FIELD_FORMATTERS.hasOwnProperty(fieldType)) {
    return FIELD_FORMATTERS[fieldType as keyof typeof FIELD_FORMATTERS].isSortable
      ? field
      : null;
  }

  return null;
}

const isDurationValue = (data: EventData, field: string): boolean => {
  return field in data && typeof data[field] === 'number';
};

export const spanOperationRelativeBreakdownRenderer = (
  data: EventData,
  {location, organization, eventView}: RenderFunctionBaggage,
  options?: RenderFunctionOptions
): React.ReactNode => {
  const {enableOnClick = true} = options ?? {};

  const sumOfSpanTime = SPAN_OP_BREAKDOWN_FIELDS.reduce(
    (prev, curr) => (isDurationValue(data, curr) ? prev + data[curr] : prev),
    0
  );
  const cumulativeSpanOpBreakdown = Math.max(sumOfSpanTime, data['transaction.duration']);

  if (
    SPAN_OP_BREAKDOWN_FIELDS.every(field => !isDurationValue(data, field)) ||
    cumulativeSpanOpBreakdown === 0
  ) {
    return FIELD_FORMATTERS.duration.renderFunc(SPAN_OP_RELATIVE_BREAKDOWN_FIELD, data);
  }

  let otherPercentage = 1;
  let orderedSpanOpsBreakdownFields;
  const sortingOnField = eventView?.sorts?.[0]?.field;
  if (sortingOnField && (SPAN_OP_BREAKDOWN_FIELDS as string[]).includes(sortingOnField)) {
    orderedSpanOpsBreakdownFields = [
      sortingOnField,
      ...SPAN_OP_BREAKDOWN_FIELDS.filter(op => op !== sortingOnField),
    ];
  } else {
    orderedSpanOpsBreakdownFields = SPAN_OP_BREAKDOWN_FIELDS;
  }

  return (
    <RelativeOpsBreakdown data-test-id="relative-ops-breakdown">
      {orderedSpanOpsBreakdownFields.map(field => {
        if (!isDurationValue(data, field)) {
          return null;
        }

        const operationName = getSpanOperationName(field) ?? 'op';
        const spanOpDuration: number = data[field];
        const widthPercentage = spanOpDuration / cumulativeSpanOpBreakdown;
        otherPercentage = otherPercentage - widthPercentage;
        if (widthPercentage === 0) {
          return null;
        }
        return (
          <div key={operationName} style={{width: toPercent(widthPercentage || 0)}}>
            <Tooltip
              title={
                <div>
                  <div>{operationName}</div>
                  <div>
                    <Duration
                      seconds={spanOpDuration / 1000}
                      fixedDigits={2}
                      abbreviation
                    />
                  </div>
                </div>
              }
              containerDisplayMode="block"
            >
              <RectangleRelativeOpsBreakdown
                style={{
                  backgroundColor: pickBarColor(operationName),
                  cursor: enableOnClick ? 'pointer' : 'default',
                }}
                onClick={event => {
                  if (!enableOnClick) {
                    return;
                  }
                  event.stopPropagation();
                  const filter = stringToFilter(operationName);
                  if (filter === SpanOperationBreakdownFilter.None) {
                    return;
                  }
                  trackAdvancedAnalyticsEvent(
                    'performance_views.relative_breakdown.selection',
                    {
                      action: filter,
                      organization,
                    }
                  );
                  browserHistory.push({
                    pathname: location.pathname,
                    query: {
                      ...location.query,
                      ...filterToLocationQuery(filter),
                    },
                  });
                }}
              />
            </Tooltip>
          </div>
        );
      })}
      <div key="other" style={{width: toPercent(otherPercentage || 0)}}>
        <Tooltip title={<div>{t('Other')}</div>} containerDisplayMode="block">
          <OtherRelativeOpsBreakdown />
        </Tooltip>
      </div>
    </RelativeOpsBreakdown>
  );
};

const RelativeOpsBreakdown = styled('div')`
  position: relative;
  display: flex;
`;

const RectangleRelativeOpsBreakdown = styled(RowRectangle)`
  position: relative;
  width: 100%;
`;

const OtherRelativeOpsBreakdown = styled(RectangleRelativeOpsBreakdown)`
  background-color: ${p => p.theme.gray100};
`;

/**
 * Get the field renderer for the named field and metadata
 *
 * @param {String} field name
 * @param {object} metadata mapping.
 * @param {boolean} isAlias convert the name with getAggregateAlias
 * @returns {Function}
 */
export function getFieldRenderer(
  field: string,
  meta: MetaType,
  isAlias: boolean = true
): FieldFormatterRenderFunctionPartial {
  if (SPECIAL_FIELDS.hasOwnProperty(field)) {
    return SPECIAL_FIELDS[field].renderFunc;
  }

  if (isRelativeSpanOperationBreakdownField(field)) {
    return spanOperationRelativeBreakdownRenderer;
  }

  const fieldName = isAlias ? getAggregateAlias(field) : field;
  const fieldType = meta[fieldName];

  for (const alias in SPECIAL_FUNCTIONS) {
    if (fieldName.startsWith(alias)) {
      return SPECIAL_FUNCTIONS[alias](fieldName);
    }
  }

  if (FIELD_FORMATTERS.hasOwnProperty(fieldType)) {
    return partial(FIELD_FORMATTERS[fieldType].renderFunc, fieldName);
  }
  return partial(FIELD_FORMATTERS.string.renderFunc, fieldName);
}

type FieldTypeFormatterRenderFunctionPartial = (
  data: EventData,
  baggage?: RenderFunctionBaggage
) => React.ReactNode;

/**
 * Get the field renderer for the named field only based on its type from the given
 * metadata.
 *
 * @param {String} field name
 * @param {object} metadata mapping.
 * @param {boolean} isAlias convert the name with getAggregateAlias
 * @returns {Function}
 */
export function getFieldFormatter(
  field: string,
  meta: MetaType,
  isAlias: boolean = true
): FieldTypeFormatterRenderFunctionPartial {
  const fieldName = isAlias ? getAggregateAlias(field) : field;
  const fieldType = meta[fieldName];

  if (FIELD_FORMATTERS.hasOwnProperty(fieldType)) {
    return partial(FIELD_FORMATTERS[fieldType].renderFunc, fieldName);
  }
  return partial(FIELD_FORMATTERS.string.renderFunc, fieldName);
}
