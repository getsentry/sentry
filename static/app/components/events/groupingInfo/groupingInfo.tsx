import {Fragment} from 'react';
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

import GroupingVariant from './groupingVariant';

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
  const hasStreamlinedUI = useHasStreamlinedUI();

  const {groupInfo, isPending, isError, isSuccess, hasPerformanceGrouping} =
    useEventGroupingInfo({
      event,
      group,
      projectSlug,
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

  const feedbackComponent = (
    <FeatureFeedback
      featureName="grouping"
      feedbackTypes={[
        t('Too eager grouping'),
        t('Too specific grouping'),
        t('Other grouping issue'),
      ]}
      buttonProps={{size: hasStreamlinedUI ? 'xs' : 'sm'}}
    />
  );

  return (
    <Fragment>
      <ConfigHeader>
        {hasStreamlinedUI && (
          <GroupInfoSummary event={event} group={group} projectSlug={projectSlug} />
        )}
        {hasStreamlinedUI ? (
          feedbackComponent
        ) : (
          <div style={{display: 'flex', justifyContent: 'flex-end', width: '100%'}}>
            {feedbackComponent}
          </div>
        )}
      </ConfigHeader>
      {isError ? <LoadingError message={t('Failed to fetch grouping info.')} /> : null}
      {isPending && !hasPerformanceGrouping ? <LoadingIndicator /> : null}
      {hasPerformanceGrouping || isSuccess
        ? variants.map((variant, index) => (
            <Fragment key={variant.key}>
              <GroupingVariant
                event={event}
                showGroupingConfig={showGroupingConfig}
                variant={variant}
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
  justify-content: space-between;
  gap: ${space(1)};
  margin-bottom: ${space(2)};
`;

const VariantDivider = styled('hr')`
  padding-top: ${space(1)};
  border-top: 1px solid ${p => p.theme.border};
`;
