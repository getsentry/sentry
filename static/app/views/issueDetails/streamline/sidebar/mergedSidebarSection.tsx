import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import {Flex} from 'sentry/components/container/flex';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {SidebarSectionTitle} from 'sentry/views/issueDetails/streamline/sidebar/sidebar';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

export function MergedIssuesSidebarSection() {
  const {baseUrl} = useGroupDetailsRoute();
  const location = useLocation();

  return (
    <Flex justify="space-between" align="center">
      <SidebarSectionTitle style={{margin: 0}}>{t('Merged Issues')}</SidebarSectionTitle>
      <SectionButton
        aria-label={t('View Merged Issues')}
        priority="link"
        size="zero"
        to={{
          pathname: `${baseUrl}${TabPaths[Tab.MERGED]}`,
          query: location.query,
          replace: true,
        }}
      >
        {t('View')}
      </SectionButton>
    </Flex>
  );
}

const SectionButton = styled(LinkButton)`
  color: ${p => p.theme.subText};
  line-height: 1;
`;
