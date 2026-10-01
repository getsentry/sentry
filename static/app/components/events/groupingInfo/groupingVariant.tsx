import {css} from '@emotion/react';

import {InfoTip} from '@sentry/scraps/info';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {getSpanHash} from 'sentry/components/events/interfaces/performance/utils';
import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import {KeyValueTableDataList} from 'sentry/components/tables/keyValueTable';
import {IconCheckmark, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {
  EntrySpans,
  Event,
  EventGroupComponent,
  EventGroupVariant,
} from 'sentry/types/event';
import {EventGroupVariantType} from 'sentry/types/event';
import {capitalize} from 'sentry/utils/string/capitalize';

import {GroupingComponent, GroupingHint} from './groupingComponent';

interface GroupingVariantProps {
  event: Event;
  showNonContributing: boolean;
  variant: EventGroupVariant;
}

type VariantData = Array<[string, React.ReactNode]>;

function addFingerprintInfo(
  data: VariantData,
  variant: EventGroupVariant,
  showNonContributing: boolean
) {
  if ('matched_rule' in variant) {
    data.push([
      t('Fingerprint rule'),
      <Grid key="type" align="center" columns="auto 1fr" gap="xs">
        {variant.matched_rule}
        <InfoTip
          size="xs"
          position="top"
          title={t('The server-side fingerprinting rule that produced the fingerprint.')}
        />
      </Grid>,
    ]);
  }
  if ('values' in variant) {
    data.push([
      t('Fingerprint values'),
      <Grid key="fingerprint-values" align="center" columns="auto 1fr" gap="xs">
        {variant.values?.join(', ') || ''}
      </Grid>,
    ]);
  }
  if (
    'client_values' in variant &&
    (showNonContributing || !('matched_rule' in variant))
  ) {
    data.push([
      t('Client fingerprint values'),
      <Grid key="type" align="center" columns="auto 1fr" gap="xs">
        {variant.client_values?.join(', ') || ''}
        {'matched_rule' in variant && (
          <GroupingHint>
            {`(${t('overridden by server-side fingerprint rule')})`}
          </GroupingHint>
        )}
      </Grid>,
    ]);
  }
}

export function GroupingVariant({
  event,
  variant,
  showNonContributing,
}: GroupingVariantProps) {
  const getVariantData = (): VariantData => {
    const data: VariantData = [];
    let component: EventGroupComponent | undefined;

    if (!showNonContributing && !variant.contributes) {
      return data;
    }

    if (variant.hash !== null) {
      data.push([
        t('Hash'),
        <Text
          as="span"
          key="hash"
          css={theme => css`
            @container (max-width: ${theme.container.xl}) {
              display: block;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              width: 210px;
            }
          `}
        >
          {variant.hash}
        </Text>,
      ]);
    }

    if (variant.hashMismatch) {
      data.push([
        t('Hash mismatch'),
        t('hashing algorithm produced a hash that does not match the event'),
      ]);
    }

    switch (variant.type) {
      case EventGroupVariantType.COMPONENT:
        component = variant.component;
        break;
      case EventGroupVariantType.CUSTOM_FINGERPRINT:
        addFingerprintInfo(data, variant, showNonContributing);
        break;
      case EventGroupVariantType.SALTED_COMPONENT:
        component = variant.component;
        addFingerprintInfo(data, variant, showNonContributing);
        break;
      case EventGroupVariantType.PERFORMANCE_PROBLEM: {
        const spansToHashes = Object.fromEntries(
          event.entries
            .find((c): c is EntrySpans => c.type === 'spans')
            ?.data?.map((span: RawSpanType) => [span.span_id, getSpanHash(span)]) ?? []
        );

        data.push(
          ['Performance Issue Type', variant.key],
          ['Span Operation', variant.evidence.op]
        );
        data.push([
          'Parent Span Hashes',
          variant.evidence?.parent_span_ids?.map(id => spansToHashes[id]) ?? [],
        ]);
        data.push([
          'Source Span Hashes',
          variant.evidence?.cause_span_ids?.map(id => spansToHashes[id]) ?? [],
        ]);
        data.push([
          'Offender Span Hashes',
          [...new Set(variant.evidence?.offender_span_ids?.map(id => spansToHashes[id]))],
        ]);
        break;
      }
      default:
        break;
    }

    if (component) {
      data.push([
        t('Grouping'),
        <Text as="div" key={component.id} variant="primary">
          <GroupingComponent
            component={component}
            showNonContributing={showNonContributing}
          />
        </Text>,
      ]);
    }

    return data;
  };

  const title = (
    <Heading as="h5" size="md">
      <Flex align="center" gap="md">
        {variant.contributes ? (
          <IconCheckmark size="sm" variant="success" />
        ) : (
          <IconClose size="sm" variant="danger" />
        )}
        <Flex align="center" gap="xs">
          {variant.description
            ?.split(' ')
            .map(i => capitalize(i))
            .join(' ') ?? t('Nothing')}
          {variant.hint && (
            <Text as="span" size="sm" variant="secondary">
              {t('(%s)', variant.hint)}
            </Text>
          )}
        </Flex>
      </Flex>
    </Heading>
  );

  const data = getVariantData();
  return (
    <Stack gap="xl" marginBottom="3xl">
      <Flex
        align={{zero: 'stretch', xl: 'center'}}
        justify="between"
        direction={{zero: 'column', xl: 'row'}}
      >
        {title}
      </Flex>

      <KeyValueTableDataList
        margin
        data={data.map(([subject, value]) => ({
          key: subject,
          subject,
          subjectNode:
            subject === t('Hash') ? (
              <Flex align="center" gap="xs">
                {subject}
                <InfoTip
                  size="xs"
                  position="top"
                  title={t('Events with the same hash are grouped together')}
                />
              </Flex>
            ) : undefined,
          value,
        }))}
        isContextData
        shouldSort={false}
      />
    </Stack>
  );
}
