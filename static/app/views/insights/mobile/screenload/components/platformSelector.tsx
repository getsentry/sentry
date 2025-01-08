import {PlatformIcon} from 'platformicons';

import {Flex} from 'sentry/components/container/flex';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import localStorage from 'sentry/utils/localStorage';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {
  DEFAULT_PLATFORM,
  PLATFORM_LOCAL_STORAGE_KEY,
  PLATFORM_QUERY_PARAM,
} from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {MobileCursors} from 'sentry/views/insights/mobile/screenload/constants';

export function PlatformSelector() {
  const navigate = useNavigate();
  const {query, pathname} = useLocation();
  const platform =
    decodeScalar(query[PLATFORM_QUERY_PARAM]) ??
    localStorage.getItem(PLATFORM_LOCAL_STORAGE_KEY) ??
    DEFAULT_PLATFORM;

  return (
    <Flex>
      <SegmentedControl
        size="md"
        value={platform}
        aria-label={t('Filter platform')}
        onChange={val => {
          localStorage.setItem(PLATFORM_LOCAL_STORAGE_KEY, val);
          navigate({
            pathname,
            query: {
              ...query,
              [MobileCursors.SCREENS_TABLE]: undefined,
              [PLATFORM_QUERY_PARAM]: val,
            },
          });
        }}
      >
        <SegmentedControl.Item
          key="Android"
          aria-label={t('Android')}
          icon={<PlatformIcon format="lg" size={28} platform="android" />}
        />
        <SegmentedControl.Item
          key="iOS"
          aria-label={t('iOS')}
          icon={
            <PlatformIcon format="lg" size={28} platform="apple" aria-label={t('iOS')} />
          }
        />
      </SegmentedControl>
    </Flex>
  );
}
