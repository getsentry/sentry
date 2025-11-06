import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import {GroupInfoSummary} from 'sentry/components/events/groupingInfo/groupingSummary';
import {useEventGroupingInfo} from 'sentry/components/events/groupingInfo/useEventGroupingInfo';
import {FeatureFeedback} from 'sentry/components/featureFeedback';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
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
  const [showNonContributing, setShowNonContributing] = useState(false);

  const hasStreamlinedUI = useHasStreamlinedUI();

  const {groupInfo, isPending, isError, isSuccess, hasPerformanceGrouping} =
    useEventGroupingInfo({
      event,
      group,
      projectSlug,
    });

  const variants = groupInfo?.variants
    ? Object.values(groupInfo.variants).sort((a, b) => {
        // Sort contributing variants before non-contributing ones
        if (a.contributes && !b.contributes) {
          return -1;
        }
        if (b.contributes && !a.contributes) {
          return 1;
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
          <GroupInfoSummary
            event={event}
            group={group}
            projectSlug={projectSlug}
            showGroupingConfig={showGroupingConfig}
          />
        )}
        {hasStreamlinedUI ? (
          feedbackComponent
        ) : (
          <div style={{display: 'flex', justifyContent: 'flex-end', width: '100%'}}>
            {feedbackComponent}
          </div>
        )}
      </ConfigHeader>
      <ToggleContainer>
        <SegmentedControl
          aria-label={t('Filter by contribution')}
          size="xs"
          value={showNonContributing ? 'all' : 'relevant'}
          onChange={key => setShowNonContributing(key === 'all')}
        >
          <SegmentedControl.Item key="relevant">
            {t('Contributing Values')}
          </SegmentedControl.Item>
          <SegmentedControl.Item key="all">{t('All Values')}</SegmentedControl.Item>
        </SegmentedControl>
      </ToggleContainer>
      {isError ? <LoadingError message={t('Failed to fetch grouping info.')} /> : null}
      {isPending && !hasPerformanceGrouping ? <LoadingIndicator /> : null}
      {hasPerformanceGrouping || isSuccess
        ? variants
            .filter(variant => variant.contributes || showNonContributing)
            .map((variant, index, filteredVariants) => (
              <Fragment key={variant.key}>
                <GroupingVariant
                  event={event}
                  variant={variant}
                  showNonContributing={showNonContributing}
                />
                {index < filteredVariants.length - 1 && <VariantDivider />}
              </Fragment>
            ))
        : null}
    </Fragment>
  );
}

const ConfigHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${p => p.theme.space.md};
  margin-bottom: ${p => p.theme.space['2xs']};
`;

const ToggleContainer = styled(Flex)`
  justify-content: flex-start;
  padding-bottom: ${p => p.theme.space.lg};
`;

const VariantDivider = styled('hr')`
  padding-top: ${p => p.theme.space.md};
  border-top: 1px solid ${p => p.theme.border};
`;
