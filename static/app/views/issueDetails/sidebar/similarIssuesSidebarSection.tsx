import {Flex} from '@sentry/scraps/layout';

import * as SidebarSection from 'sentry/components/sidebarSection';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {ViewButton} from 'sentry/views/issueDetails/sidebar/viewButton';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

export function SimilarIssuesSidebarSection() {
  const {baseUrl} = useGroupDetailsRoute();
  const location = useLocation();

  return (
    <Flex justify="between" align="center">
      <SidebarSection.Title variant="primary" style={{margin: 0}}>
        {t('Similar Issues')}
      </SidebarSection.Title>
      <ViewButton
        aria-label={t('View Similar Issues')}
        to={{
          pathname: `${baseUrl}${TabPaths[Tab.SIMILAR_ISSUES]}`,
          query: location.query,
        }}
        replace
        preventScrollReset
      >
        {t('View')}
      </ViewButton>
    </Flex>
  );
}
