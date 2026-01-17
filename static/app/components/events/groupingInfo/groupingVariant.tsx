import styled from '@emotion/styled';

import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconCheckmark, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {
  EntrySpans,
  Event,
  EventGroupComponent,
  EventGroupVariant,
} from 'sentry/types/event';
import {EventGroupVariantType} from 'sentry/types/event';
import {capitalize} from 'sentry/utils/string/capitalize';

import GroupingComponent, {GroupingHint} from './groupingComponent';

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
      <TextWithQuestionTooltip key="type">
        {variant.matched_rule}
        <QuestionTooltip
          size="xs"
          position="top"
          title={t('The server-side fingerprinting rule that produced the fingerprint.')}
        />
      </TextWithQuestionTooltip>,
    ]);
  }
  if ('values' in variant) {
    data.push([
      t('Fingerprint values'),
      <TextWithQuestionTooltip key="fingerprint-values">
        {variant.values?.join(', ') || ''}
      </TextWithQuestionTooltip>,
    ]);
  }
  if (
    'client_values' in variant &&
    (showNonContributing || !('matched_rule' in variant))
  ) {
    data.push([
      t('Client fingerprint values'),
      <TextWithQuestionTooltip key="type">
        {variant.client_values?.join(', ') || ''}
        {'matched_rule' in variant && (
          <GroupingHint>
            {`(${t('overridden by server-side fingerprint rule')})`}
          </GroupingHint>
        )}
      </TextWithQuestionTooltip>,
    ]);
  }
}

function GroupingVariant({event, variant, showNonContributing}: GroupingVariantProps) {
  const getVariantData = (): [VariantData, EventGroupComponent | undefined] => {
    const data: VariantData = [];
    let component: EventGroupComponent | undefined;

    if (!showNonContributing && !variant.contributes) {
      return [data, component];
    }

    if (variant.hash !== null) {
      data.push([
        t('Hash'),
        <TextWithQuestionTooltip key="hash">
          <Hash>{variant.hash}</Hash>
          <QuestionTooltip
            size="xs"
            position="top"
            title={t('Events with the same hash are grouped together')}
          />
        </TextWithQuestionTooltip>,
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
            ?.data?.map((span: RawSpanType) => [span.span_id, span.hash]) ?? []
        );

        data.push(['Performance Issue Type', variant.key]);
        data.push(['Span Operation', variant.evidence.op]);
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
        <GroupingTree key={component.id}>
          <GroupingComponent
            component={component}
            showNonContributing={showNonContributing}
          />
        </GroupingTree>,
      ]);
    }

    return [data, component];
  };

  const renderTitle = () => {
    const isContributing = variant.contributes;

    const hint = variant.hint;

    return (
      <VariantTitle>
        <ContributionIcon isContributing={isContributing} />
        {variant.description
          ?.split(' ')
          .map(i => capitalize(i))
          .join(' ') ?? t('Nothing')}
        <VariantHint>{hint && t('(%s)', hint)}</VariantHint>
      </VariantTitle>
    );
  };

  const [data] = getVariantData();
  return (
    <VariantWrapper>
      <Header>{renderTitle()}</Header>

      <KeyValueList
        data={data.map(d => ({
          key: d[0],
          subject: d[0],
          value: d[1],
        }))}
        isContextData
        shouldSort={false}
      />
    </VariantWrapper>
  );
}

const VariantWrapper = styled('div')`
  margin-bottom: ${space(4)};
`;

const Header = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(2)};
  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    display: block;
  }
`;

const VariantTitle = styled('h5')`
  font-size: ${p => p.theme.fontSize.md};
  margin: 0;
  display: flex;
  align-items: center;
`;

const VariantHint = styled('span')`
  font-size: ${p => p.theme.fontSize.sm};
  margin-left: ${p => p.theme.space.xs};
  font-weight: ${p => p.theme.fontWeight.normal};
  color: ${p => p.theme.tokens.content.secondary};
`;

const ContributionIcon = styled(({isContributing, ...p}: any) =>
  isContributing ? (
    <IconCheckmark size="sm" variant="success" {...p} />
  ) : (
    <IconClose size="sm" variant="danger" {...p} />
  )
)`
  margin-right: ${space(1)};
`;

const GroupingTree = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
`;

const TextWithQuestionTooltip = styled('div')`
  display: grid;
  align-items: center;
  grid-template-columns: auto 1fr;
  gap: ${space(0.5)};
`;

const Hash = styled('span')`
  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 210px;
  }
`;

export default GroupingVariant;
