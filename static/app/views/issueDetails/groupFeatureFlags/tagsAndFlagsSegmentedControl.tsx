import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

/**
 * Segmented control for switching between /tags/ and /feature-flags/ drawers and routes.
 */
export default function TagsAndFlagsSegmentedControl({
  tab,
}: {
  tab: 'tags' | 'featureFlags';
}) {
  const {baseUrl} = useGroupDetailsRoute();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <SegmentedControl
      size="xs"
      value={tab}
      onChange={newTab => {
        if (newTab === 'tags') {
          navigate(
            {
              pathname: `${baseUrl}${TabPaths[Tab.TAGS]}`,
              query: {...location.query},
            },
            {replace: true}
          );
        } else if (newTab === 'featureFlags') {
          navigate(
            {
              pathname: `${baseUrl}${TabPaths[Tab.FEATURE_FLAGS]}`,
              query: {...location.query},
            },
            {replace: true}
          );
        }
      }}
    >
      <SegmentedControl.Item key="tags">{t('All Tags')}</SegmentedControl.Item>
      <SegmentedControl.Item key="featureFlags">
        {t('All Feature Flags')}
      </SegmentedControl.Item>
    </SegmentedControl>
  );
}
