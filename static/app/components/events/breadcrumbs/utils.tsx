import styled from '@emotion/styled';

import Tag from 'sentry/components/badge/tag';
import type {SelectOption} from 'sentry/components/compactSelect';
import type {BreadcrumbMeta} from 'sentry/components/events/interfaces/breadcrumbs/types';
import {
  convertCrumbType,
  getVirtualCrumb,
} from 'sentry/components/events/interfaces/breadcrumbs/utils';
import type {ColorConfig} from 'sentry/components/timeline';
import {
  IconCursorArrow,
  IconFire,
  IconFix,
  IconInfo,
  IconLocation,
  IconMobile,
  IconRefresh,
  IconSort,
  IconSpan,
  IconStack,
  IconTerminal,
  IconUser,
  IconWarning,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  BreadcrumbLevelType,
  BreadcrumbType,
  type RawCrumb,
} from 'sentry/types/breadcrumbs';
import {EntryType, type Event} from 'sentry/types/event';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

export const BREADCRUMB_TIMESTAMP_PLACEHOLDER = '--';
const BREADCRUMB_TITLE_PLACEHOLDER = t('Generic');
const BREADCRUMB_SUMMARY_COUNT = 3;

export const enum BreadcrumbTimeDisplay {
  RELATIVE = 'relative',
  ABSOLUTE = 'absolute',
}
export const BREADCRUMB_TIME_DISPLAY_OPTIONS = [
  {label: t('Relative'), value: BreadcrumbTimeDisplay.RELATIVE},
  {label: t('Absolute'), value: BreadcrumbTimeDisplay.ABSOLUTE},
];
export const BREADCRUMB_TIME_DISPLAY_LOCALSTORAGE_KEY = 'event-breadcrumb-time-display';

const Color = styled('span')<{colorConfig: ColorConfig}>`
  color: ${p => p.theme[p.colorConfig.primary]};
`;

/**
 * Returns a summary of the provided breadcrumbs.
 * As of writing this, it just grabs a few, but in the future it may collapse,
 * or manipulate them in some way for a better summary.
 */
export function getSummaryBreadcrumbs(crumbs: EnhancedCrumb[]) {
  return [...crumbs].reverse().slice(0, BREADCRUMB_SUMMARY_COUNT);
}

export function applyBreadcrumbSearch(
  search: string,
  crumbs: EnhancedCrumb[]
): EnhancedCrumb[] {
  if (search === '') {
    return crumbs;
  }
  return crumbs.filter(
    ({breadcrumb: c}) =>
      c.type.includes(search) ||
      c.message?.includes(search) ||
      c.category?.includes(search) ||
      (c.data && JSON.stringify(c.data)?.includes(search))
  );
}

export function getBreadcrumbFilterOptions(crumbs: EnhancedCrumb[]) {
  const uniqueCrumbTypes = crumbs.reduce((crumbTypeSet, {breadcrumb: crumb}) => {
    crumbTypeSet.add(crumb.type);
    return crumbTypeSet;
  }, new Set<BreadcrumbType>());

  const filterOptions: SelectOption<string>[] = [...uniqueCrumbTypes].map(crumbType => {
    const crumbFilter = getBreadcrumbFilter(crumbType);
    return {
      value: crumbFilter,
      label: crumbFilter,
      leadingItems: (
        <Color colorConfig={getBreadcrumbColorConfig(crumbType)}>
          <BreadcrumbIcon type={crumbType} />
        </Color>
      ),
    };
  });
  return filterOptions.sort((a, b) => a.value.localeCompare(b.value));
}
export interface EnhancedCrumb {
  // Mutated crumb where we change types or virtual crumb
  breadcrumb: RawCrumb;
  colorConfig: ReturnType<typeof getBreadcrumbColorConfig>;
  filter: ReturnType<typeof getBreadcrumbFilter>;
  iconComponent: ReturnType<typeof BreadcrumbIcon>;
  levelComponent: ReturnType<typeof BreadcrumbLevel>;
  // Display props
  title: ReturnType<typeof getBreadcrumbTitle>;
  meta?: BreadcrumbMeta;
  // Exact crumb extracted from the event. If raw is missing, crumb is virtual.
  raw?: RawCrumb;
}

/**
 * This is necessary to keep breadcrumbs with their associated meta annotations. The meta object for
 * crumbs on the event uses an array index, but in practice we append to the list (with virtual crumbs),
 * change the sort, and filter it. To avoid having to mutate the meta indeces, keep them together from the start.
 *
 * Display props are also added to reduce repeated iterations.
 */
export function getEnhancedBreadcrumbs(event: Event): EnhancedCrumb[] {
  const breadcrumbEntryIndex =
    event.entries?.findIndex(entry => entry.type === EntryType.BREADCRUMBS) ?? -1;
  const breadcrumbs = event.entries?.[breadcrumbEntryIndex]?.data?.values ?? [];

  if (breadcrumbs.length === 0) {
    return [];
  }

  // Mapping of breadcrumb index -> breadcrumb meta
  const meta: Record<number, any> =
    event._meta?.entries?.[breadcrumbEntryIndex]?.data?.values ?? {};

  const enhancedCrumbs: EnhancedCrumb[] = breadcrumbs.map((raw, i) => ({
    raw,
    meta: meta[i],
    // Converts breadcrumbs into other types if sufficient data is present.
    breadcrumb: convertCrumbType(raw),
  }));

  // The virtual crumb is a representation of this event, displayed alongside
  // the rest of the breadcrumbs for more additional context.
  const virtualCrumb = getVirtualCrumb(event);
  const allCrumbs = virtualCrumb
    ? [...enhancedCrumbs, {breadcrumb: virtualCrumb}]
    : enhancedCrumbs;

  // Add display props
  return allCrumbs.map(ec => ({
    ...ec,
    title: getBreadcrumbTitle(ec.breadcrumb.category),
    colorConfig: getBreadcrumbColorConfig(ec.breadcrumb.type),
    filter: getBreadcrumbFilter(ec.breadcrumb.type),
    iconComponent: <BreadcrumbIcon type={ec.breadcrumb.type} />,
    levelComponent: <BreadcrumbLevel level={ec.breadcrumb.level} />,
  }));
}

function getBreadcrumbTitle(category: RawCrumb['category']) {
  switch (category) {
    case 'http':
    case 'xhr':
      return category.toUpperCase();
    case 'httplib':
      return t('httplib');
    case 'ui.click':
      return t('UI Click');
    case 'ui.input':
      return t('UI Input');
    case null:
    case undefined:
      return BREADCRUMB_TITLE_PLACEHOLDER;
    default:
      const titleCategory = category.split('.').join(' ');
      return toTitleCase(titleCategory);
  }
}

function getBreadcrumbColorConfig(type?: BreadcrumbType): ColorConfig {
  switch (type) {
    case BreadcrumbType.ERROR:
      return {primary: 'red400', secondary: 'red200'};
    case BreadcrumbType.WARNING:
      return {primary: 'yellow400', secondary: 'yellow200'};
    case BreadcrumbType.NAVIGATION:
    case BreadcrumbType.HTTP:
    case BreadcrumbType.QUERY:
    case BreadcrumbType.TRANSACTION:
      return {primary: 'green400', secondary: 'green200'};
    case BreadcrumbType.USER:
    case BreadcrumbType.UI:
      return {primary: 'purple400', secondary: 'purple200'};
    case BreadcrumbType.SYSTEM:
    case BreadcrumbType.SESSION:
      return {primary: 'pink400', secondary: 'pink200'};
    case BreadcrumbType.DEBUG:
    case BreadcrumbType.INFO:
    default:
      return {primary: 'gray300', secondary: 'gray200'};
  }
}

function getBreadcrumbFilter(type?: BreadcrumbType) {
  switch (type) {
    case BreadcrumbType.USER:
    case BreadcrumbType.UI:
      return t('User Action');
    case BreadcrumbType.NAVIGATION:
      return t('Navigation');
    case BreadcrumbType.DEBUG:
      return t('Debug');
    case BreadcrumbType.INFO:
      return t('Info');
    case BreadcrumbType.ERROR:
      return t('Error');
    case BreadcrumbType.HTTP:
      return t('HTTP Request');
    case BreadcrumbType.WARNING:
      return t('Warning');
    case BreadcrumbType.QUERY:
      return t('Query');
    case BreadcrumbType.SYSTEM:
      return t('System');
    case BreadcrumbType.SESSION:
      return t('Session');
    case BreadcrumbType.TRANSACTION:
      return t('Transaction');
    default:
      return t('Default');
  }
}

function BreadcrumbIcon({type}: {type?: BreadcrumbType}) {
  switch (type) {
    case BreadcrumbType.USER:
      return <IconUser size="xs" />;
    case BreadcrumbType.UI:
      return <IconCursorArrow size="xs" />;
    case BreadcrumbType.NAVIGATION:
      return <IconLocation size="xs" />;
    case BreadcrumbType.DEBUG:
      return <IconFix size="xs" />;
    case BreadcrumbType.INFO:
      return <IconInfo size="xs" />;
    case BreadcrumbType.ERROR:
      return <IconFire size="xs" />;
    case BreadcrumbType.HTTP:
      return <IconSort size="xs" rotated />;
    case BreadcrumbType.WARNING:
      return <IconWarning size="xs" />;
    case BreadcrumbType.QUERY:
      return <IconStack size="xs" />;
    case BreadcrumbType.SYSTEM:
      return <IconMobile size="xs" />;
    case BreadcrumbType.SESSION:
      return <IconRefresh size="xs" />;
    case BreadcrumbType.TRANSACTION:
      return <IconSpan size="xs" />;
    default:
      return <IconTerminal size="xs" />;
  }
}

function BreadcrumbLevel({level}: {level: BreadcrumbLevelType}) {
  switch (level) {
    case BreadcrumbLevelType.ERROR:
    case BreadcrumbLevelType.FATAL:
      return <StyledTag type="error">{level}</StyledTag>;
    case BreadcrumbLevelType.WARNING:
      return <StyledTag type="warning">{level}</StyledTag>;
    case BreadcrumbLevelType.DEBUG:
    case BreadcrumbLevelType.INFO:
    case BreadcrumbLevelType.LOG:
      return <StyledTag type="highlight">{level}</StyledTag>;
    case BreadcrumbLevelType.UNDEFINED:
    default:
      return null;
  }
}

const StyledTag = styled(Tag)`
  margin: 0 ${space(1)};
  font-weight: normal;
`;
