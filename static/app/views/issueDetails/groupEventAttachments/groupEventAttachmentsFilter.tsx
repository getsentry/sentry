import styled from '@emotion/styled';
import omit from 'lodash/omit';
import xor from 'lodash/xor';

import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Project} from 'sentry/types';
import {isMobilePlatform} from 'sentry/utils/platform';
import {useLocation} from 'sentry/utils/useLocation';
import useRouter from 'sentry/utils/useRouter';

const crashReportTypes = ['event.minidump', 'event.applecrashreport'];
const SCREENSHOT_TYPE = 'event.screenshot';

type Props = {
  project: Project;
};

function GroupEventAttachmentsFilter(props: Props) {
  const {project} = props;
  const {query, pathname} = useLocation();
  const router = useRouter();
  const {types} = query;
  const allAttachmentsQuery = omit(query, 'types');
  const onlyCrashReportsQuery = {
    ...query,
    types: crashReportTypes,
  };

  const onlyScreenshotQuery = {
    ...query,
    types: SCREENSHOT_TYPE,
  };

  let activeButton: 'all' | 'screenshot' | 'onlyCrash' = 'all';

  if (types === undefined) {
    activeButton = 'all';
  } else if (types === SCREENSHOT_TYPE) {
    activeButton = 'screenshot';
  } else if (xor(crashReportTypes, types).length === 0) {
    activeButton = 'onlyCrash';
  }

  return (
    <FilterWrapper>
      <SegmentedControl
        aria-label={t('Algorithm')}
        size="sm"
        value={activeButton}
        onChange={key => {
          switch (key) {
            case 'screenshot':
              router.replace({pathname, query: onlyScreenshotQuery});
              break;
            case 'onlyCrash':
              router.replace({pathname, query: onlyCrashReportsQuery});
              break;
            case 'all':
            default:
              router.replace({pathname, query: allAttachmentsQuery});
          }
        }}
      >
        {[
          <SegmentedControl.Item key="all">{t('All Attachments')}</SegmentedControl.Item>,
          ...(isMobilePlatform(project.platform)
            ? [
                <SegmentedControl.Item key="screenshot">
                  {t('Screenshots')}
                </SegmentedControl.Item>,
              ]
            : []),
          <SegmentedControl.Item key="onlyCrash">
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
  margin-bottom: ${space(3)};
`;

export {crashReportTypes, SCREENSHOT_TYPE};
export default GroupEventAttachmentsFilter;
