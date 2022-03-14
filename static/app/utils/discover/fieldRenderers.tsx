import * as React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import partial from 'lodash/partial';

import Count from 'sentry/components/count';
import Duration from 'sentry/components/duration';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import UserBadge from 'sentry/components/idBadge/userBadge';
import ExternalLink from 'sentry/components/links/externalLink';
import {RowRectangle} from 'sentry/components/performance/waterfall/rowBar';
import {pickBarColor, toPercent} from 'sentry/components/performance/waterfall/utils';
import Tooltip from 'sentry/components/tooltip';
import UserMisery from 'sentry/components/userMisery';
import Version from 'sentry/components/version';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {defined, isUrl} from 'sentry/utils';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
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
type RenderFunctionBaggage = {
  location: Location;
  organization: Organization;
  eventView?: EventView;
};

type FieldFormatterRenderFunction = (field: string, data: EventData) => React.ReactNode;

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
  string: FieldFormatter;
};

export type FieldTypes = keyof FieldFormatters;

const EmptyValueContainer = styled('span')`
  color: ${p => p.theme.gray300};
`;
const emptyValue = <EmptyValueContainer>{t('n/a')}</EmptyValueContainer>;

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
    renderFunc: (field, data) => (
      <Container>
        {data[field]
          ? getDynamicText({
              value: <FieldDateTime date={data[field]} />,
              fixed: 'timestamp',
            })
          : emptyValue}
      </Container>
    ),
  },
  duration: {
    isSortable: true,
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
      return <Container>{value}</Container>;
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
  'count_unique(user)': SpecialField;
  'error.handled': SpecialField;
  id: SpecialField;
  issue: SpecialField;
  'issue.id': SpecialField;
  project: SpecialField;
  release: SpecialField;
  team_key_transaction: SpecialField;
  'timestamp.to_day': SpecialField;
  'timestamp.to_hour': SpecialField;
  trace: SpecialField;
  'trend_percentage()': SpecialField;
  user: SpecialField;
  'user.display': SpecialField;
};

/**
 * "Special fields" either do not map 1:1 to an single column in the event database,
 * or they require custom UI formatting that can't be handled by the datatype formatters.
 */
const SPECIAL_FIELDS: SpecialFields = {
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
        return null;
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
      return (
        <Container>
          <Projects orgId={organization.slug} slugs={[data.project]}>
            {({projects}) => {
              const project = projects.find(p => p.slug === data.project);
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
      const count = data.count_unique_user;
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
      const value = Array.isArray(values) ? values.slice(-1)[0] : values;
      return <Container>{[1, null].includes(value) ? 'true' : 'false'}</Container>;
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
          value: <FieldDateTime date={data['timestamp.to_hour']} format="lll z" />,
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
          value: <FieldDateTime date={data['timestamp.to_day']} dateOnly utc />,
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
      userMiseryField.split('_').pop() || '',
      10
    );
    if (isNaN(miseryLimit)) {
      countMiserableUserField = 'count_miserable_user';
      if (projectThresholdConfig in data) {
        miseryLimit = data[projectThresholdConfig][1];
      } else {
        miseryLimit = undefined;
      }
    } else {
      countMiserableUserField = `count_miserable_user_${miseryLimit}`;
    }

    const uniqueUsers = data.count_unique_user;

    let miserableUsers: number | undefined;

    if (countMiserableUserField in data) {
      const countMiserableMiseryLimit = parseInt(
        countMiserableUserField.split('_').pop() || '',
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

const spanOperationRelativeBreakdownRenderer = (
  data: EventData,
  {location, organization, eventView}: RenderFunctionBaggage
): React.ReactNode => {
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
  if (sortingOnField && SPAN_OP_BREAKDOWN_FIELDS.includes(sortingOnField)) {
    orderedSpanOpsBreakdownFields = [
      sortingOnField,
      ...SPAN_OP_BREAKDOWN_FIELDS.filter(op => op !== sortingOnField),
    ];
  } else {
    orderedSpanOpsBreakdownFields = SPAN_OP_BREAKDOWN_FIELDS;
  }
  return (
    <RelativeOpsBreakdown>
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
                spanBarHatch={false}
                style={{
                  backgroundColor: pickBarColor(operationName),
                  cursor: 'pointer',
                }}
                onClick={event => {
                  event.stopPropagation();
                  const filter = stringToFilter(operationName);
                  if (filter === SpanOperationBreakdownFilter.None) {
                    return;
                  }
                  trackAnalyticsEvent({
                    eventName: 'Performance Views: Select Relative Breakdown',
                    eventKey: 'performance_views.relative_breakdown.selection',
                    organization_id: parseInt(organization.id, 10),
                    action: filter as string,
                  });
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
          <OtherRelativeOpsBreakdown spanBarHatch={false} />
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

type FieldTypeFormatterRenderFunctionPartial = (data: EventData) => React.ReactNode;

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
