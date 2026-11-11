import {Flex} from '@sentry/scraps/layout';

import * as SidebarSection from 'sentry/components/sidebarSection';
import {t} from 'sentry/locale';
import {IssueDetailsDrawer} from 'sentry/views/issueDetails/issueDetailsQueryParams';
import {useIssueDetailsLinks} from 'sentry/views/issueDetails/useGroupDetailsRoute';

import {ViewButton} from './viewButton';

export function SimilarIssuesSidebarSection() {
  const links = useIssueDetailsLinks();

  return (
    <Flex justify="between" align="center">
      <SidebarSection.Title variant="primary" style={{margin: 0}}>
        {t('Similar Issues')}
      </SidebarSection.Title>
      <ViewButton
        aria-label={t('View Similar Issues')}
        to={links.drawer(IssueDetailsDrawer.SIMILAR_ISSUES)}
        replace
        preventScrollReset
      >
        {t('View')}
      </ViewButton>
    </Flex>
  );
}
