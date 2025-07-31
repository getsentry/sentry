import type {Location} from 'history';

import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {FieldValueType, getFieldDefinition} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import type {AttributesTreeContent} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {
  SENTRY_SEARCHABLE_SPAN_NUMBER_TAGS,
  SENTRY_SEARCHABLE_SPAN_STRING_TAGS,
} from 'sentry/views/explore/constants';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {makeTracesPathname} from 'sentry/views/traces/pathnames';

export function getProfileMeta(event: EventTransaction | null) {
  const profileId = event?.contexts?.profile?.profile_id;
  if (profileId) {
    return profileId;
  }
  const profilerId = event?.contexts?.profile?.profiler_id;
  if (profilerId) {
    const start = new Date(event.startTimestamp * 1000);
    const end = new Date(event.endTimestamp * 1000);
    return {
      profiler_id: profilerId,
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }
  return null;
}

export enum TraceDrawerActionValueKind {
  TAG = 'tag',
  MEASUREMENT = 'measurement',
  ADDITIONAL_DATA = 'additional_data',
  SENTRY_TAG = 'sentry_tag',
  ATTRIBUTE = 'attribute',
}

export enum TraceDrawerActionKind {
  INCLUDE = 'include',
  EXCLUDE = 'exclude',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
}

export function getSearchInExploreTarget(
  organization: Organization,
  location: Location,
  projectIds: string | string[] | undefined,
  key: string,
  value: string,
  kind: TraceDrawerActionKind
) {
  const {start, end, statsPeriod} = normalizeDateTimeParams(location.query);
  const search = new MutableSearch('');

  if (kind === TraceDrawerActionKind.INCLUDE) {
    search.setFilterValues(key, [value]);
  } else if (kind === TraceDrawerActionKind.EXCLUDE) {
    search.setFilterValues(`!${key}`, [`${value}`]);
  } else if (kind === TraceDrawerActionKind.GREATER_THAN) {
    search.setFilterValues(key, [`>${value}`]);
  } else {
    search.setFilterValues(key, [`<${value}`]);
  }

  return {
    pathname: makeTracesPathname({
      organization,
      path: '/',
    }),
    query: {
      start,
      end,
      statsPeriod,
      query: search.formatString(),
      project: projectIds ? projectIds : ALL_ACCESS_PROJECTS,
    },
  };
}

export function findSpanAttributeValue(
  attributes: TraceItemResponseAttribute[],
  attributeName: string
) {
  return attributes.find(attribute => attribute.name === attributeName)?.value.toString();
}

// Sort attributes so that span.* attributes are at the beginning and
// the rest of the attributes are sorted alphabetically.
export function sortAttributes(attributes: TraceItemResponseAttribute[]) {
  return [...attributes].sort((a, b) => {
    const aIsSpan = a.name.startsWith('span.');
    const bIsSpan = b.name.startsWith('span.');

    if (aIsSpan && !bIsSpan) {
      return -1;
    }
    if (!aIsSpan && bIsSpan) {
      return 1;
    }
    return a.name.localeCompare(b.name);
  });
}

export type KeyValueActionParams = {
  location: Location;
  organization: Organization;
  rowKey: string;
  rowValue: React.ReactNode;
  kind?: TraceDrawerActionValueKind;
  projectIds?: string | string[];
};

export function getTraceKeyValueActions(params: KeyValueActionParams): MenuItemProps[] {
  const {rowKey, rowValue, kind, projectIds, location, organization} = params;
  const hasExploreEnabled = organization.features.includes('visibility-explore-view');

  if (
    !hasExploreEnabled ||
    !defined(rowValue) ||
    !defined(rowKey) ||
    !['string', 'number'].includes(typeof rowValue)
  ) {
    return [];
  }

  // We assume that tags, measurements and additional data (span.data) are dynamic lists of searchable keys in explore.
  // Any other key must exist in the static list of sentry tags to be deemed searchable.
  if (
    kind === TraceDrawerActionValueKind.SENTRY_TAG &&
    !(
      SENTRY_SEARCHABLE_SPAN_NUMBER_TAGS.includes(rowKey) ||
      SENTRY_SEARCHABLE_SPAN_STRING_TAGS.includes(rowKey)
    )
  ) {
    return [];
  }

  const dropdownOptions = [
    {
      key: 'include',
      label: t('Find more samples with this value'),
      to: getSearchInExploreTarget(
        organization,
        location,
        projectIds,
        rowKey,
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        rowValue.toString(),
        TraceDrawerActionKind.INCLUDE
      ),
    },
    {
      key: 'exclude',
      label: t('Find samples excluding this value'),
      to: getSearchInExploreTarget(
        organization,
        location,
        projectIds,
        rowKey,
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        rowValue.toLocaleString(),
        TraceDrawerActionKind.EXCLUDE
      ),
    },
  ];

  const valueType = getFieldDefinition(rowKey, 'span')?.valueType;
  const isNumeric =
    typeof rowValue === 'number' ||
    (valueType &&
      [
        FieldValueType.DURATION,
        FieldValueType.NUMBER,
        FieldValueType.INTEGER,
        FieldValueType.PERCENTAGE,
        FieldValueType.DATE,
        FieldValueType.RATE,
        FieldValueType.PERCENT_CHANGE,
      ].includes(valueType));

  if (isNumeric) {
    dropdownOptions.push(
      {
        key: 'includeGreaterThan',
        label: t('Find samples with values greater than'),
        to: getSearchInExploreTarget(
          organization,
          location,
          projectIds,
          rowKey,
          // eslint-disable-next-line @typescript-eslint/no-base-to-string
          rowValue.toString(),
          TraceDrawerActionKind.GREATER_THAN
        ),
      },
      {
        key: 'includeLessThan',
        label: t('Find samples with values less than'),
        to: getSearchInExploreTarget(
          organization,
          location,
          projectIds,
          rowKey,
          // eslint-disable-next-line @typescript-eslint/no-base-to-string
          rowValue.toString(),
          TraceDrawerActionKind.LESS_THAN
        ),
      }
    );
  }

  return dropdownOptions;
}

export function getTraceAttributesTreeActions(
  params: Pick<KeyValueActionParams, 'location' | 'organization' | 'projectIds'>
): (content: AttributesTreeContent) => MenuItemProps[] {
  return (content: AttributesTreeContent) => {
    const rowKey = content.originalAttribute?.original_attribute_key;
    const rowValue = content.value;
    if (!rowKey || !rowValue) {
      return [];
    }

    return getTraceKeyValueActions({
      rowKey,
      rowValue: content.value,
      kind: TraceDrawerActionValueKind.ATTRIBUTE,
      projectIds: params.projectIds,
      location: params.location,
      organization: params.organization,
    });
  };
}
