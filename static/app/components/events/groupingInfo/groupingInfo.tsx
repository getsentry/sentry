import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {GroupInfoSummary} from 'sentry/components/events/groupingInfo/groupingSummary';
import {useEventGroupingInfo} from 'sentry/components/events/groupingInfo/useEventGroupingInfo';
import {FeatureFeedback} from 'sentry/components/featureFeedback';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

import GroupingConfigSelect from './groupingConfigSelect';
import GroupingVariant from './groupingVariant';

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

interface GroupingSummaryProps {
  event: Event;
  group: Group | undefined;
  projectSlug: string;
  showGroupingConfig: boolean;
}

export default function GroupingInfo({
  event,
  projectSlug,
  showGroupingConfig,
  group,
}: GroupingSummaryProps) {
  const [configOverride, setConfigOverride] = useState<string | null>(null);
  const hasStreamlinedUI = useHasStreamlinedUI();

  const {groupInfo, isPending, isError, isSuccess, hasPerformanceGrouping} =
    useEventGroupingInfo({
      event,
      group,
      projectSlug,
      query: configOverride ? {config: configOverride} : {},
    });

  const variants = groupInfo
    ? Object.values(groupInfo).sort((a, b) => {
        // Sort variants with hashes before those without
        if (a.hash && !b.hash) {
          return -1;
        }

        // Sort by description alphabetically
        const descA = a.description?.toLowerCase() ?? '';
        const descB = b.description?.toLowerCase() ?? '';
        return descA.localeCompare(descB);
      })
    : [];

  return (
    <Fragment>
      {hasStreamlinedUI && (
        <GroupInfoSummary event={event} group={group} projectSlug={projectSlug} />
      )}
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
          feedbackTypes={[
            t('Too eager grouping'),
            t('Too specific grouping'),
            t('Other grouping issue'),
          ]}
          buttonProps={{size: 'sm'}}
        />
      </ConfigHeader>
      {isError ? <LoadingError message={t('Failed to fetch grouping info.')} /> : null}
      {isPending && !hasPerformanceGrouping ? <LoadingIndicator /> : null}
      {hasPerformanceGrouping || isSuccess
        ? variants.map((variant, index) => (
            <Fragment key={variant.key}>
              <GroupingVariant
                event={event}
                variant={variant}
                showGroupingConfig={showGroupingConfig}
              />
              {index < variants.length - 1 && <VariantDivider />}
            </Fragment>
          ))
        : null}
    </Fragment>
  );
}

const ConfigHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${space(1)};
  margin-bottom: ${space(2)};
`;

const VariantDivider = styled('hr')`
  padding-top: ${space(1)};
  border-top: 1px solid ${p => p.theme.border};
`;
