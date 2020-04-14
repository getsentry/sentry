import React from 'react';
import {Location} from 'history';
import partial from 'lodash/partial';

import {Organization} from 'app/types';
import {t} from 'app/locale';
import Count from 'app/components/count';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import UserBadge from 'app/components/idBadge/userBadge';
import getDynamicText from 'app/utils/getDynamicText';
import Duration from 'app/components/duration';
import ShortId from 'app/components/shortId';
import {formatFloat, formatPercentage} from 'app/utils/formatters';
import Version from 'app/components/version';
import {getAggregateAlias} from 'app/utils/discover/fields';

import {
  Container,
  NumberContainer,
  OverflowLink,
  StyledDateTime,
  VersionContainer,
} from './styles';
import {MetaType, EventData} from './eventView';

/**
 * Types, functions and definitions for rendering fields in discover results.
 */
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
  date: FieldFormatter;
  duration: FieldFormatter;
  integer: FieldFormatter;
  number: FieldFormatter;
  percentage: FieldFormatter;
  string: FieldFormatter;
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
const FIELD_FORMATTERS: FieldFormatters = {
  boolean: {
    sortField: true,
    renderFunc: (field, data) => {
      const value = data[field] ? t('yes') : t('no');
      return <Container>{value}</Container>;
    },
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
        {typeof data[field] === 'number' ? formatFloat(data[field], 4) : emptyValue}
      </NumberContainer>
    ),
  },
  percentage: {
    sortField: true,
    renderFunc: (field, data) => (
      <NumberContainer>
        {typeof data[field] === 'number' ? formatPercentage(data[field]) : emptyValue}
      </NumberContainer>
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
  'issue.id': SpecialField;
  issue: SpecialField;
  release: SpecialField;
};

/**
 * "Special fields" do not map 1:1 to an single column in the event database,
 * they are a UI concept that combines the results of multiple fields and
 * displays with a custom render function.
 */
const SPECIAL_FIELDS: SpecialFields = {
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
    sortField: 'project',
    renderFunc: (data, {organization}) => {
      const project = organization.projects.find(p => p.slug === data.project);
      return (
        <Container>
          {project ? <ProjectBadge project={project} avatarSize={16} /> : data.project}
        </Container>
      );
    },
  },
  user: {
    sortField: 'user.id',
    renderFunc: data => {
      const userObj = {
        id: data.user,
        name: data.user,
        email: data.user,
        username: data.user,
        ip_address: '',
      };

      const badge = <UserBadge user={userObj} hideEmail avatarSize={16} />;

      return <Container>{badge}</Container>;
    },
  },
  release: {
    sortField: 'release',
    renderFunc: data =>
      data.release && (
        <VersionContainer>
          <Version version={data.release} anchor={false} tooltipRawVersion truncate />
        </VersionContainer>
      ),
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

  const fieldType = tableMeta[field];
  if (FIELD_FORMATTERS.hasOwnProperty(fieldType)) {
    return FIELD_FORMATTERS[fieldType as keyof typeof FIELD_FORMATTERS].sortField
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

  if (FIELD_FORMATTERS.hasOwnProperty(fieldType)) {
    return partial(FIELD_FORMATTERS[fieldType].renderFunc, fieldName);
  }
  return partial(FIELD_FORMATTERS.string.renderFunc, fieldName);
}
