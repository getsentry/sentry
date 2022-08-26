import round from 'lodash/round';

import {t, tct} from 'sentry/locale';
import {FeatureFlagSegmentTagKind} from 'sentry/types/featureFlags';
import {defined} from 'sentry/utils';

import {Tags} from './tags';
import {TruncatedLabel} from './truncatedLabel';

type Tag = React.ComponentProps<typeof Tags>['tags'][0];

export function getInnerNameLabel(name: FeatureFlagSegmentTagKind) {
  switch (name) {
    case FeatureFlagSegmentTagKind.ENVIRONMENT:
      return t('Environment');
    case FeatureFlagSegmentTagKind.RELEASE:
      return t('Release');
    case FeatureFlagSegmentTagKind.TRANSACTION:
      return t('Transaction');
    case FeatureFlagSegmentTagKind.CUSTOM:
      return t('Custom');
    default:
      return '';
  }
}

export function getMatchFieldPlaceholder(category: FeatureFlagSegmentTagKind) {
  switch (category) {
    case FeatureFlagSegmentTagKind.ENVIRONMENT:
      return t('ex. prod, dev');
    case FeatureFlagSegmentTagKind.RELEASE:
      return t('ex. 1*, [I3].[0-9].*');
    case FeatureFlagSegmentTagKind.TRANSACTION:
      return t('ex. /api/0/issues/');
    case FeatureFlagSegmentTagKind.CUSTOM:
      return t('Enter tag values');
    default:
      return undefined;
  }
}

export function getTagKey(tag: Tag) {
  switch (tag.category) {
    case FeatureFlagSegmentTagKind.RELEASE:
      return 'release';
    case FeatureFlagSegmentTagKind.ENVIRONMENT:
      return 'environment';
    case FeatureFlagSegmentTagKind.TRANSACTION:
      return 'transaction';
    case FeatureFlagSegmentTagKind.CUSTOM:
      return 'custom';
    default:
      return undefined;
  }
}

export function generateTagCategoriesOptions(
  tagCategoriesOptions: FeatureFlagSegmentTagKind[]
): [FeatureFlagSegmentTagKind, string][] {
  const sortedTagCategories = tagCategoriesOptions
    .filter(
      tagCategoriesOption => tagCategoriesOption !== FeatureFlagSegmentTagKind.CUSTOM
    )
    // sort dropdown options alphabetically based on display labels
    .sort((a, b) => getInnerNameLabel(a).localeCompare(getInnerNameLabel(b)));

  // massage into format that select component understands
  return [...sortedTagCategories, FeatureFlagSegmentTagKind.CUSTOM].map(innerName => [
    innerName,
    getInnerNameLabel(innerName),
  ]);
}

export function formatCreateTagLabel(label: string) {
  return tct('Add "[newLabel]"', {
    newLabel: <TruncatedLabel value={label} />,
  });
}

export function validResultValue(value: string | number | boolean | undefined) {
  if (!defined(value)) {
    return false;
  }

  if (typeof value === 'string') {
    return !!value.trim();
  }

  if (typeof value === 'number') {
    return !isNaN(value);
  }

  return true;
}

export function rateToPercentage(rate: number | undefined, decimalPlaces: number = 2) {
  if (!defined(rate)) {
    return rate;
  }

  return round(rate * 100, decimalPlaces);
}

export function percentageToRate(rate: number | undefined, decimalPlaces: number = 4) {
  if (!defined(rate)) {
    return rate;
  }

  return round(rate / 100, decimalPlaces);
}
