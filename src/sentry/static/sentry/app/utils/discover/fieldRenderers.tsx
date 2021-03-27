import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import partial from 'lodash/partial';

import Count from 'app/components/count';
import Duration from 'app/components/duration';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import UserBadge from 'app/components/idBadge/userBadge';
import UserMisery from 'app/components/userMisery';
import UserMiseryPrototype from 'app/components/userMiseryPrototype';
import Version from 'app/components/version';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import {defined} from 'app/utils';
import {AGGREGATIONS, getAggregateAlias} from 'app/utils/discover/fields';
import {getShortEventId} from 'app/utils/events';
import {formatFloat, formatPercentage} from 'app/utils/formatters';
import getDynamicText from 'app/utils/getDynamicText';
import Projects from 'app/utils/projects';

import ArrayValue from './arrayValue';
import {EventData, MetaType} from './eventView';
import KeyTransactionField from './keyTransactionField';
import {
  BarContainer,
  Container,
  NumberContainer,
  OverflowLink,
  StyledDateTime,
  StyledShortId,
  VersionContainer,
} from './styles';

/**
 * Types, functions and definitions for rendering fields in discover results.
 */
type RenderFunctionBaggage = {
  organization: Organization;
  location: Location;
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
  boolean: FieldFormatter;
  date: FieldFormatter;
  duration: FieldFormatter;
  integer: FieldFormatter;
  number: FieldFormatter;
  percentage: FieldFormatter;
  string: FieldFormatter;
  array: FieldFormatter;
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
const FIELD_FORMATTERS: FieldFormatters = {
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
              value: <StyledDateTime date={data[field]} />,
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
  sortField: string | null;
  renderFunc: SpecialFieldRenderFunc;
};

type SpecialFields = {
  id: SpecialField;
  trace: SpecialField;
  project: SpecialField;
  user: SpecialField;
  'user.display': SpecialField;
  'issue.id': SpecialField;
  'error.handled': SpecialField;
  issue: SpecialField;
  release: SpecialField;
  key_transaction: SpecialField;
  'trend_percentage()': SpecialField;
  'timestamp.to_hour': SpecialField;
  'timestamp.to_day': SpecialField;
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
            <StyledShortId shortId={`${data.issue}`} />
          </Container>
        );
      }

      const target = {
        pathname: `/organizations/${organization.slug}/issues/${issueID}/`,
      };

      return (
        <Container>
          <OverflowLink to={target} aria-label={issueID}>
            <StyledShortId shortId={`${data.issue}`} />
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
  key_transaction: {
    sortField: 'key_transaction',
    renderFunc: (data, {organization}) => (
      <Container>
        <KeyTransactionField
          isKeyTransaction={(data.key_transaction ?? 0) !== 0}
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
          value: <StyledDateTime date={data['timestamp.to_hour']} format="lll z" />,
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
          value: <StyledDateTime date={data['timestamp.to_day']} format="MMM D, YYYY" />,
          fixed: 'timestamp.to_day',
        })}
      </Container>
    ),
  },
};

type SpecialFunctions = {
  user_misery_prototype: SpecialFieldRenderFunc;
  user_misery: SpecialFieldRenderFunc;
};

/**
 * "Special functions" are functions whose values either do not map 1:1 to a single column,
 * or they require custom UI formatting that can't be handled by the datatype formatters.
 */
const SPECIAL_FUNCTIONS: SpecialFunctions = {
  user_misery_prototype: data => {
    const uniqueUsers = data.count_unique_user;
    let miseryField: string = '';
    let userMiseryField: string = '';
    for (const field in data) {
      if (field.startsWith('user_misery_prototype')) {
        miseryField = field;
      } else if (field.startsWith('user_misery')) {
        userMiseryField = field;
      }
    }

    if (!miseryField) {
      return <NumberContainer>{emptyValue}</NumberContainer>;
    }

    const miserableUsers = userMiseryField ? data[userMiseryField] : undefined;
    const userMisery = miseryField ? data[miseryField] : undefined;

    const miseryLimit = parseInt(miseryField.split('_').pop() || '', 10);

    return (
      <BarContainer>
        <UserMiseryPrototype
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
  user_misery: data => {
    const uniqueUsers = data.count_unique_user;
    let userMiseryField: string = '';
    for (const field in data) {
      if (field.startsWith('user_misery')) {
        userMiseryField = field;
      }
    }
    if (!userMiseryField) {
      return <NumberContainer>{emptyValue}</NumberContainer>;
    }

    const userMisery = data[userMiseryField];
    if (!uniqueUsers && uniqueUsers !== 0) {
      return (
        <NumberContainer>
          {typeof userMisery === 'number' ? formatFloat(userMisery, 4) : emptyValue}
        </NumberContainer>
      );
    }

    const miseryLimit = parseInt(userMiseryField.split('_').pop() || '', 10);

    return (
      <BarContainer>
        <UserMisery
          bars={10}
          barHeight={20}
          miseryLimit={miseryLimit}
          totalUsers={uniqueUsers}
          miserableUsers={userMisery}
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

  if (field.startsWith('user_misery_prototype')) {
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

/**
 * Get the field renderer for the named field and metadata
 *
 * @param {String} field name
 * @param {object} metadata mapping.
 * @returns {Function}
 */
export function getFieldRenderer(
  field: string,
  meta: MetaType
): FieldFormatterRenderFunctionPartial {
  if (SPECIAL_FIELDS.hasOwnProperty(field)) {
    return SPECIAL_FIELDS[field].renderFunc;
  }
  const fieldName = getAggregateAlias(field);
  const fieldType = meta[fieldName];

  for (const alias in SPECIAL_FUNCTIONS) {
    if (fieldName.startsWith(alias)) {
      return SPECIAL_FUNCTIONS[alias];
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
 * @returns {Function}
 */
export function getFieldFormatter(
  field: string,
  meta: MetaType
): FieldTypeFormatterRenderFunctionPartial {
  const fieldName = getAggregateAlias(field);
  const fieldType = meta[fieldName];

  if (FIELD_FORMATTERS.hasOwnProperty(fieldType)) {
    return partial(FIELD_FORMATTERS[fieldType].renderFunc, fieldName);
  }
  return partial(FIELD_FORMATTERS.string.renderFunc, fieldName);
}
