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
  getBucketsFromGlobalFilters,
  getNavigationTypeDataset,
  isAllBucketsSelected,
  NAVIGATION_TYPE_BUCKET_ORDER,
  NAVIGATION_TYPE_BUCKETS,
  normalizeBuckets,
  type NavigationTypeBucket,
} from './settings';
import {useNavigationTypeCounts} from './useNavigationTypeCounts';

type Props = {
  globalFilters: GlobalFilter[];
  onChange: (globalFilters: GlobalFilter[]) => void;
};

/** Splits web vitals by the kind of navigation they were measured on. */
export function NavigationTypeSwitcher({globalFilters, onChange}: Props) {
  const organization = useOrganization();
  const buckets = getBucketsFromGlobalFilters(globalFilters);
  const isAll = isAllBucketsSelected(buckets);
  const dataset = getNavigationTypeDataset(globalFilters);

  const {counts, untaggedCount, isPending} = useNavigationTypeCounts({globalFilters});

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
              '[count] web vitals have no navigation type (sent before the SDK started tagging it). They are counted as page loads.',
              {count: <strong>{formatAbbreviatedNumber(untaggedCount)}</strong>}
            )}
          </MenuComponents.Alert>
        ) : undefined
      }
      onChange={selected => {
        const nextBuckets = normalizeBuckets(selected.map(option => option.value));
        onChange(
          mergeGlobalFilters(globalFilters, [
            buildNavigationTypeGlobalFilter(nextBuckets, dataset),
          ])
        );
        trackAnalytics('insight.vital.select_navigation_type', {
          organization,
          // An empty selection is "All".
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
