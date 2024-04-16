import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {FeatureFeedback} from 'sentry/components/featureFeedback';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types';
import {EventGroupVariantType, IssueCategory} from 'sentry/types';
import type {Event, EventGroupVariant} from 'sentry/types/event';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import SectionToggleButton from 'sentry/views/issueDetails/sectionToggleButton';

import GroupingConfigSelect from './groupingConfigSelect';
import GroupVariant from './groupingVariant';

const groupingFeedbackTypes = [
  t('Too eager grouping'),
  t('Too specific grouping'),
  t('Other grouping issue'),
];

type GroupingInfoProps = {
  event: Event;
  projectSlug: string;
  showGroupingConfig: boolean;
  group?: Group;
};

type EventGroupingInfoResponse = {
  [variant: string]: EventGroupVariant;
};

function generatePerformanceGroupInfo({
  event,
  group,
}: {
  event: Event;
  group: Group;
}): EventGroupingInfoResponse | null {
  if (!event.occurrence) {
    return null;
  }

  const {evidenceData} = event.occurrence;

  const hash = event.occurrence?.fingerprint[0] || '';

  return group
    ? {
        [group.issueType]: {
          description: t('performance problem'),
          hash: event.occurrence?.fingerprint[0] || '',
          hashMismatch: false,
          key: group.issueType,
          type: EventGroupVariantType.PERFORMANCE_PROBLEM,
          evidence: {
            op: evidenceData?.op,
            parent_span_ids: evidenceData?.parentSpanIds,
            cause_span_ids: evidenceData?.causeSpanIds,
            offender_span_ids: evidenceData?.offenderSpanIds,
            desc: t('performance problem'),
            fingerprint: hash,
          },
        },
      }
    : null;
}

function GroupConfigSelect({
  event,
  configOverride,
  setConfigOverride,
}: {
  configOverride: string | null;
  event: Event;
  setConfigOverride: (value: string) => void;
}) {
  if (!event.groupingConfig) {
    return null;
  }

  const configId = configOverride ?? event.groupingConfig?.id;

  return (
    <GroupingConfigSelect
      eventConfigId={event.groupingConfig.id}
      configId={configId}
      onSelect={selection => setConfigOverride(selection.value)}
    />
  );
}

function GroupInfoSummary({groupInfo}: {groupInfo: EventGroupingInfoResponse | null}) {
  const groupedBy = groupInfo
    ? Object.values(groupInfo)
        .filter(variant => variant.hash !== null && variant.description !== null)
        .map(variant => variant.description)
        .sort((a, b) => a!.toLowerCase().localeCompare(b!.toLowerCase()))
        .join(', ')
    : t('nothing');

  return (
    <p data-test-id="loaded-grouping-info">
      <strong>{t('Grouped by:')}</strong> {groupedBy}
    </p>
  );
}

export function EventGroupingInfo({
  event,
  projectSlug,
  showGroupingConfig,
  group,
}: GroupingInfoProps) {
  const organization = useOrganization();
  const [isOpen, setIsOpen] = useState(false);
  const [configOverride, setConfigOverride] = useState<string | null>(null);

  const hasPerformanceGrouping =
    event.occurrence &&
    group?.issueCategory === IssueCategory.PERFORMANCE &&
    event.type === 'transaction';

  const {data, isLoading, isError, isSuccess} = useApiQuery<EventGroupingInfoResponse>(
    [
      `/projects/${organization.slug}/${projectSlug}/events/${event.id}/grouping-info/`,
      {query: configOverride ? {config: configOverride} : {}},
    ],
    {enabled: !hasPerformanceGrouping, staleTime: Infinity}
  );

  const groupInfo = hasPerformanceGrouping
    ? generatePerformanceGroupInfo({group, event})
    : data ?? null;

  const variants = groupInfo
    ? Object.values(groupInfo).sort((a, b) =>
        a.hash && !b.hash
          ? -1
          : a.description
              ?.toLowerCase()
              .localeCompare(b.description?.toLowerCase() ?? '') ?? 1
      )
    : [];

  return (
    <EventDataSection
      type="grouping-info"
      title={t('Event Grouping Information')}
      actions={<SectionToggleButton isExpanded={isOpen} onExpandChange={setIsOpen} />}
    >
      {!isOpen ? <GroupInfoSummary groupInfo={groupInfo} /> : null}
      {isOpen ? (
        <Fragment>
          <ConfigHeader>
            <div>
              {showGroupingConfig && (
                <GroupConfigSelect
                  event={event}
                  configOverride={configOverride}
                  setConfigOverride={setConfigOverride}
                />
              )}
            </div>
            <FeatureFeedback
              featureName="grouping"
              feedbackTypes={groupingFeedbackTypes}
              buttonProps={{size: 'sm'}}
            />
          </ConfigHeader>
          {isError ? (
            <LoadingError message={t('Failed to fetch grouping info.')} />
          ) : null}
          {isLoading && !hasPerformanceGrouping ? <LoadingIndicator /> : null}
          {hasPerformanceGrouping || isSuccess
            ? variants.map((variant, index) => (
                <Fragment key={variant.key}>
                  <GroupVariant
                    event={event}
                    variant={variant}
                    showGroupingConfig={showGroupingConfig}
                  />
                  {index < variants.length - 1 && <VariantDivider />}
                </Fragment>
              ))
            : null}
        </Fragment>
      ) : null}
    </EventDataSection>
  );
}

const ConfigHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${space(1)};
  margin-bottom: ${space(2)};
`;

export const GroupingConfigItem = styled('span')<{
  isActive?: boolean;
  isHidden?: boolean;
}>`
  font-family: ${p => p.theme.text.familyMono};
  opacity: ${p => (p.isHidden ? 0.5 : null)};
  font-weight: ${p => (p.isActive ? 'bold' : null)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const VariantDivider = styled('hr')`
  padding-top: ${space(1)};
  border-top: 1px solid ${p => p.theme.border};
`;
