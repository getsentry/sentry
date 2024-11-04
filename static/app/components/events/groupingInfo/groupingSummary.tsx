import {useEventGroupingInfo} from 'sentry/components/events/groupingInfo/useEventGroupingInfo';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';

export function GroupInfoSummary({
  event,
  group,
  projectSlug,
}: {
  event: Event;
  group: Group | undefined;
  projectSlug: string;
}) {
  const {groupInfo} = useEventGroupingInfo({
    event,
    group,
    projectSlug,
    query: {},
  });
  const groupedBy = groupInfo
    ? Object.values(groupInfo)
        .filter(variant => variant.hash !== null && variant.description !== null)
        .map(variant => variant.description!)
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
        .join(', ')
    : t('nothing');

  return (
    <p data-test-id="loaded-grouping-info">
      <strong>{t('Grouped by:')}</strong> {groupedBy}
    </p>
  );
}
