import {parseAsString, useQueryStates} from 'nuqs';

import {Flex} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';

import {t} from 'sentry/locale';

export const enum EventAttachmentFilter {
  ALL = 'all',
  CRASH_REPORTS = 'onlyCrash',
  SCREENSHOT = 'screenshot',
}

type AttachmentFilterValue = `${EventAttachmentFilter}`;

interface GroupEventAttachmentsFilterProps {
  onChange?: (filter: EventAttachmentFilter) => void;
}

export function GroupEventAttachmentsFilter({
  onChange,
}: GroupEventAttachmentsFilterProps) {
  const [{attachmentFilter}, setQueryParams] = useQueryStates({
    attachmentFilter: parseAsString,
    cursor: parseAsString,
  });

  const activeFilter =
    (attachmentFilter as AttachmentFilterValue | null) ?? EventAttachmentFilter.ALL;

  return (
    <Flex maxWidth="100%">
      <SegmentedControl
        aria-label={t('Attachment Filter')}
        size="sm"
        value={activeFilter}
        onChange={key => {
          setQueryParams({attachmentFilter: key, cursor: null});
          onChange?.(key as EventAttachmentFilter);
        }}
      >
        <SegmentedControl.Item key={EventAttachmentFilter.ALL}>
          {t('All Attachments')}
        </SegmentedControl.Item>
        <SegmentedControl.Item key={EventAttachmentFilter.SCREENSHOT}>
          {t('Screenshots')}
        </SegmentedControl.Item>
        <SegmentedControl.Item key={EventAttachmentFilter.CRASH_REPORTS}>
          {t('Only Crash Reports')}
        </SegmentedControl.Item>
      </SegmentedControl>
    </Flex>
  );
}
