import {Flex} from 'sentry/components/container/flex';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {SidebarSectionTitle} from 'sentry/views/issueDetails/streamline/sidebar/sidebar';
import {ViewButton} from 'sentry/views/issueDetails/streamline/sidebar/viewButton';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

export function SimilarIssuesSidebarSection() {
  const {baseUrl} = useGroupDetailsRoute();
  const location = useLocation();

  return (
    <Flex justify="space-between" align="center">
      <SidebarSectionTitle style={{margin: 0}}>{t('Similar Issues')}</SidebarSectionTitle>
      <ViewButton
        aria-label={t('View Similar Issues')}
        to={{
          pathname: `${baseUrl}${TabPaths[Tab.SIMILAR_ISSUES]}`,
          query: location.query,
        }}
      >
        {t('View')}
      </ViewButton>
    </Flex>
  );
}
