import styled from '@emotion/styled';

import Tag from 'sentry/components/badge/tag';
import type {SelectOption} from 'sentry/components/compactSelect';
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
export function getSummaryBreadcrumbs(crumbs: RawCrumb[]) {
  return [...crumbs].reverse().slice(0, BREADCRUMB_SUMMARY_COUNT);
}

export function applyBreadcrumbSearch(search: string, crumbs: RawCrumb[]): RawCrumb[] {
  if (search === '') {
    return crumbs;
  }
  return crumbs.filter(
    c =>
      c.type.includes(search) ||
      c.message?.includes(search) ||
      c.category?.includes(search) ||
      (c.data && JSON.stringify(c.data)?.includes(search))
  );
}

export function getBreadcrumbFilters(crumbs: RawCrumb[]) {
  const uniqueCrumbTypes = crumbs.reduce((crumbTypeSet, crumb) => {
    crumbTypeSet.add(crumb.type);
    return crumbTypeSet;
  }, new Set<BreadcrumbType>());

  const filters: SelectOption<string>[] = [...uniqueCrumbTypes].map(crumbType => {
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

  return filters;
}

export function getBreadcrumbTitle(category: RawCrumb['category']) {
  switch (category) {
    case 'http':
      return t('HTTP');
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

export function getBreadcrumbColorConfig(type?: BreadcrumbType): ColorConfig {
  switch (type) {
    case BreadcrumbType.ERROR:
      return {primary: 'red400', secondary: 'red200'};
    case BreadcrumbType.WARNING:
      return {primary: 'yellow400', secondary: 'yellow200'};
    case BreadcrumbType.NAVIGATION:
    case BreadcrumbType.HTTP:
      return {primary: 'green400', secondary: 'green200'};
    case BreadcrumbType.INFO:
    case BreadcrumbType.QUERY:
    case BreadcrumbType.UI:
      return {primary: 'blue400', secondary: 'blue200'};
    case BreadcrumbType.USER:
    case BreadcrumbType.DEBUG:
      return {primary: 'purple400', secondary: 'purple200'};
    case BreadcrumbType.SYSTEM:
    case BreadcrumbType.SESSION:
    case BreadcrumbType.TRANSACTION:
      return {primary: 'pink400', secondary: 'pink200'};
    default:
      return {primary: 'gray300', secondary: 'gray200'};
  }
}

export function getBreadcrumbFilter(type?: BreadcrumbType) {
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
      return t('HTTP request');
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

export function BreadcrumbIcon({type}: {type?: BreadcrumbType}) {
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

export function BreadcrumbTag({level}: {level: BreadcrumbLevelType}) {
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
