import styled from '@emotion/styled';

import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {isMobilePlatform} from 'sentry/utils/platform';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

export const enum EventAttachmentFilter {
  ALL = 'all',
  CRASH_REPORTS = 'onlyCrash',
  SCREENSHOT = 'screenshot',
}

type AttachmentFilterValue = `${EventAttachmentFilter}`;

type Props = {
  project: Project;
};

function GroupEventAttachmentsFilter(props: Props) {
  const {project} = props;
  const location = useLocation();
  const navigate = useNavigate();

  const activeFilter: AttachmentFilterValue =
    (location.query.attachmentFilter as AttachmentFilterValue | undefined) ??
    EventAttachmentFilter.ALL;

  return (
    <FilterWrapper>
      <SegmentedControl
        aria-label={t('Attachment Filter')}
        size="sm"
        value={activeFilter}
        onChange={key => {
          navigate(
            {
              pathname: location.pathname,
              query: {...location.query, attachmentFilter: key},
            },
            {replace: true}
          );
        }}
      >
        {[
          <SegmentedControl.Item key={EventAttachmentFilter.ALL}>
            {t('All Attachments')}
          </SegmentedControl.Item>,
          ...(isMobilePlatform(project.platform)
            ? [
                <SegmentedControl.Item key={EventAttachmentFilter.SCREENSHOT}>
                  {t('Screenshots')}
                </SegmentedControl.Item>,
              ]
            : []),
          <SegmentedControl.Item key={EventAttachmentFilter.CRASH_REPORTS}>
            {t('Only Crash Reports')}
          </SegmentedControl.Item>,
        ]}
      </SegmentedControl>
    </FilterWrapper>
  );
}

const FilterWrapper = styled('div')`
  display: flex;
  justify-content: flex-end;
`;

export default GroupEventAttachmentsFilter;
