import {useEffect, useMemo, useRef} from 'react';

import {Badge} from '@sentry/scraps/badge';
import {
  CompactSelect,
  MenuComponents,
  type SelectOption,
} from '@sentry/scraps/compactSelect';
import {Container, Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {useOrganization} from 'sentry/utils/useOrganization';
import {mergeGlobalFilters} from 'sentry/views/dashboards/globalFilter/utils';
import type {GlobalFilter} from 'sentry/views/dashboards/types';
import {
  buildNavigationTypeGlobalFilter,
  DEFAULT_NAVIGATION_TYPE_BUCKETS,
  getBucketsFromGlobalFilters,
  isAllBucketsSelected,
  isNavigationTypeGlobalFilter,
  NAVIGATION_TYPE_BUCKET_ORDER,
  NAVIGATION_TYPE_BUCKETS,
  normalizeBuckets,
  type NavigationTypeBucket,
} from 'sentry/views/insights/browser/webVitals/navigationType/settings';
import {useNavigationTypeCounts} from 'sentry/views/insights/browser/webVitals/navigationType/useNavigationTypeCounts';
import {spanFilterQueryFromGlobalFilters} from 'sentry/views/insights/browser/webVitals/navigationType/utils';

type Props = {
  globalFilters: GlobalFilter[];
  onChange: (globalFilters: GlobalFilter[]) => void;
};

/**
 * Experimental control that splits web vitals by the kind of navigation they
 * were measured on. Selecting more than one is allowed, but a mixed selection
 * is a blend of populations rather than a single measurement, which is why the
 * dashboard drops its thresholds outside a page loads only selection.
 */
export function NavigationTypeSwitcher({globalFilters, onChange}: Props) {
  const organization = useOrganization();
  const buckets = getBucketsFromGlobalFilters(globalFilters);
  const isAll = isAllBucketsSelected(buckets);

  // The other spans filters (browser, subregion, ...) so the counts in the menu
  // match the numbers the widgets will render.
  const additionalQuery = useMemo(
    () =>
      spanFilterQueryFromGlobalFilters(
        globalFilters.filter(filter => !isNavigationTypeGlobalFilter(filter))
      ),
    [globalFilters]
  );

  const {counts, untaggedCount, isPending} = useNavigationTypeCounts({additionalQuery});

  // Write the default out on first render so the widgets and the threshold
  // check read the same explicit selection as this control.
  const hasWrittenDefault = useRef(false);
  const hasFilter = globalFilters.some(isNavigationTypeGlobalFilter);
  useEffect(() => {
    if (hasFilter || hasWrittenDefault.current) {
      return;
    }
    hasWrittenDefault.current = true;
    onChange(
      mergeGlobalFilters(globalFilters, [
        buildNavigationTypeGlobalFilter(DEFAULT_NAVIGATION_TYPE_BUCKETS),
      ])
    );
  }, [hasFilter, globalFilters, onChange]);

  const options: Array<SelectOption<NavigationTypeBucket>> =
    NAVIGATION_TYPE_BUCKET_ORDER.map(candidate => {
      const config = NAVIGATION_TYPE_BUCKETS[candidate];
      const count = counts[candidate];
      const isEmpty = !isPending && count === 0;

      return {
        value: candidate,
        label: config.label(),
        textValue: config.label(),
        details: isEmpty ? config.emptyReason() : config.description?.(),
        trailingItems: (
          <Badge variant={isEmpty ? 'warning' : 'muted'}>
            {isPending ? '…' : formatAbbreviatedNumber(count)}
          </Badge>
        ),
      };
    });

  return (
    <CompactSelect
      multiple
      value={buckets}
      options={options}
      menuTitle={t('Measured on')}
      menuWidth={340}
      closeOnSelect={false}
      menuFooter={
        untaggedCount > 0 ? (
          <MenuComponents.Alert variant="info">
            {tct(
              '[count] spans have no navigation type (sent before the SDK started tagging it). They are counted as page loads.',
              {count: <strong>{formatAbbreviatedNumber(untaggedCount)}</strong>}
            )}
          </MenuComponents.Alert>
        ) : undefined
      }
      onChange={selected => {
        const nextBuckets = normalizeBuckets(selected.map(option => option.value));
        onChange(
          mergeGlobalFilters(globalFilters, [
            buildNavigationTypeGlobalFilter(nextBuckets),
          ])
        );
        trackAnalytics('insight.vital.select_navigation_type', {
          organization,
          // Empty selection reads as "All", same as the other filter chips.
          navigation_types: (nextBuckets.length ? nextBuckets : ['all']).join(','),
        });
      }}
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps}>
          <NavigationTypeTriggerLabel buckets={buckets} isAll={isAll} />
        </OverlayTrigger.Button>
      )}
    />
  );
}

function NavigationTypeTriggerLabel({
  buckets,
  isAll,
}: {
  buckets: NavigationTypeBucket[];
  isAll: boolean;
}) {
  const firstLabel = buckets[0] ? NAVIGATION_TYPE_BUCKETS[buckets[0]].label() : '';

  return (
    <Flex gap="xs" align="center" minWidth={0}>
      <Text variant="primary">{t('Measured on')}</Text>
      <Text variant="muted" bold={false}>
        {':'}
      </Text>
      {isAll ? (
        <Text variant="primary" bold={false}>
          {t('All')}
        </Text>
      ) : (
        <Container minWidth={0} flexShrink={1} overflow="hidden">
          <Text variant="primary" bold={false} ellipsis>
            {firstLabel}
          </Text>
        </Container>
      )}
      {!isAll && buckets.length > 1 && (
        <Container>
          <Badge variant="muted">{`+${buckets.length - 1}`}</Badge>
        </Container>
      )}
    </Flex>
  );
}
