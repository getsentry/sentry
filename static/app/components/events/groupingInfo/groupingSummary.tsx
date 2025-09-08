import React from 'react';

import {useEventGroupingInfo} from 'sentry/components/events/groupingInfo/useEventGroupingInfo';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';

export function GroupInfoSummary({
  event,
  group,
  projectSlug,
  showGroupingConfig,
}: {
  event: Event;
  group: Group | undefined;
  projectSlug: string;
  showGroupingConfig: boolean;
}) {
  const {groupInfo, isPending, hasPerformanceGrouping} = useEventGroupingInfo({
    event,
    group,
    projectSlug,
  });
  const groupedBy = groupInfo
    ? Object.values(groupInfo)
        .filter(variant => variant.hash !== null && variant.description !== null)
        .map(variant => variant.description!)
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
        .join(', ')
    : t('nothing');

  const groupingConfig =
    showGroupingConfig && groupInfo
      ? (
          Object.values(groupInfo).find(
            variant => 'config' in variant && variant.config?.id
          ) as any
        )?.config?.id
      : null;

  if (isPending && !hasPerformanceGrouping) {
    return <Placeholder height="20px" style={{marginBottom: '20px'}} />;
  }

  return (
    <p data-test-id="loaded-grouping-info">
      <strong>{t('Grouped by:')}</strong> {groupedBy}
      {groupingConfig && (
        <React.Fragment>
          <br />
          <strong>{t('Grouping Config:')}</strong> {groupingConfig}
        </React.Fragment>
      )}
    </p>
  );
}
