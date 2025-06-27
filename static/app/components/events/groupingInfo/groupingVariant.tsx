import {useState} from 'react';
import styled from '@emotion/styled';

import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import {Tooltip} from 'sentry/components/core/tooltip';
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

import GroupingComponent from './groupingComponent';
import {hasNonContributingComponent} from './utils';

interface GroupingVariantProps {
  event: Event;
  showGroupingConfig: boolean;
  variant: EventGroupVariant;
}

type VariantData = Array<[string, React.ReactNode]>;

function addFingerprintInfo(data: VariantData, variant: EventGroupVariant) {
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
  if ('client_values' in variant) {
    data.push([
      t('Client fingerprint values'),
      <TextWithQuestionTooltip key="type">
        {variant.client_values?.join(', ') || ''}
        {'matched_rule' in variant && ( // Only display override tooltip if overriding actually happened
          <QuestionTooltip
            size="xs"
            position="top"
            title={t(
              'The client sent a fingerprint that was overridden by a server-side fingerprinting rule.'
            )}
          />
        )}
      </TextWithQuestionTooltip>,
    ]);
  }
}

function GroupingVariant({event, showGroupingConfig, variant}: GroupingVariantProps) {
  const [showNonContributing, setShowNonContributing] = useState(false);

  const getVariantData = (): [VariantData, EventGroupComponent | undefined] => {
    const data: VariantData = [];
    let component: EventGroupComponent | undefined;

    if (!showNonContributing && variant.hash === null) {
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

        if (showGroupingConfig && variant.config?.id) {
          data.push([t('Grouping Config'), variant.config.id]);
        }
        break;
      case EventGroupVariantType.CUSTOM_FINGERPRINT:
        addFingerprintInfo(data, variant);
        break;
      case EventGroupVariantType.BUILT_IN_FINGERPRINT:
        addFingerprintInfo(data, variant);
        break;
      case EventGroupVariantType.SALTED_COMPONENT:
        component = variant.component;
        addFingerprintInfo(data, variant);
        if (showGroupingConfig && variant.config?.id) {
          data.push([t('Grouping Config'), variant.config.id]);
        }
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

  const renderContributionToggle = () => {
    return (
      <SegmentedControl
        aria-label={t('Filter by contribution')}
        size="xs"
        value={showNonContributing ? 'all' : 'relevant'}
        onChange={key => setShowNonContributing(key === 'all')}
      >
        <SegmentedControl.Item key="relevant">
          {t('Contributing values')}
        </SegmentedControl.Item>
        <SegmentedControl.Item key="all">{t('All values')}</SegmentedControl.Item>
      </SegmentedControl>
    );
  };

  const renderTitle = () => {
    const isContributing = variant.hash !== null;

    let title: string;
    if (isContributing) {
      title = t('Contributing variant');
    } else {
      const hint = 'component' in variant ? variant.component?.hint : undefined;
      if (hint) {
        title = t('Non-contributing variant: %s', hint);
      } else {
        title = t('Non-contributing variant');
      }
    }

    return (
      <Tooltip title={title}>
        <VariantTitle>
          <ContributionIcon isContributing={isContributing} />
          {t('By')}{' '}
          {variant.description
            ?.split(' ')
            .map(i => capitalize(i))
            .join(' ') ?? t('Nothing')}
        </VariantTitle>
      </Tooltip>
    );
  };

  const [data, component] = getVariantData();
  return (
    <VariantWrapper>
      <Header>
        {renderTitle()}
        {hasNonContributingComponent(component) && renderContributionToggle()}
      </Header>

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

const ContributionIcon = styled(({isContributing, ...p}: any) =>
  isContributing ? (
    <IconCheckmark size="sm" isCircled color="successText" {...p} />
  ) : (
    <IconClose size="sm" isCircled color="dangerText" {...p} />
  )
)`
  margin-right: ${space(1)};
`;

const GroupingTree = styled('div')`
  color: ${p => p.theme.textColor};
`;

const TextWithQuestionTooltip = styled('div')`
  display: grid;
  align-items: center;
  grid-template-columns: auto 1fr;
  gap: ${space(0.5)};
`;

const Hash = styled('span')`
  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    ${p => p.theme.overflowEllipsis};
    width: 210px;
  }
`;

export default GroupingVariant;
