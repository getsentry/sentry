import {Fragment} from 'react';

import {t} from 'sentry/locale';

import type {EventGroupingInfoResponse} from './useEventGroupingInfo';

export function GroupInfoSummary({
  groupInfo,
  showGroupingConfig,
}: {
  groupInfo: EventGroupingInfoResponse | null;
  showGroupingConfig: boolean;
}) {
  const groupedBy =
    Object.values(groupInfo?.variants ?? {})
      .filter(variant => variant.contributes)
      .flatMap(variant => (variant.description ? [variant.description] : []))
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      .join(', ') || t('nothing');

  return (
    <p data-test-id="loaded-grouping-info">
      <strong>{t('Grouped by:')}</strong> {groupedBy}
      {showGroupingConfig && groupInfo?.grouping_config && (
        <Fragment>
          <br />
          <strong>{t('Grouping Config:')}</strong> {groupInfo.grouping_config}
        </Fragment>
      )}
    </p>
  );
}
