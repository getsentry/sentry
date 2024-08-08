import {useMemo} from 'react';
import styled from '@emotion/styled';

import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import type {ProfilingBreadcrumbsProps} from 'sentry/components/profiling/profilingBreadcrumbs';
import {ProfilingBreadcrumbs} from 'sentry/components/profiling/profilingBreadcrumbs';
import useOrganization from 'sentry/utils/useOrganization';

export function ContinuousProfileHeader() {
  const organization = useOrganization();
  // @TODO add breadcrumbs when other views are implemented
  const breadCrumbs = useMemo((): ProfilingBreadcrumbsProps['trails'] => {
    return [{type: 'landing', payload: {query: {}}}];
  }, []);

  return (
    <SmallerLayoutHeader>
      <SmallerHeaderContent>
        <SmallerProfilingBreadcrumbsWrapper>
          <ProfilingBreadcrumbs organization={organization} trails={breadCrumbs} />
        </SmallerProfilingBreadcrumbsWrapper>
      </SmallerHeaderContent>
      <StyledHeaderActions>
        <FeedbackWidgetButton />
      </StyledHeaderActions>
    </SmallerLayoutHeader>
  );
}

const StyledHeaderActions = styled(Layout.HeaderActions)`
  display: flex;
  flex-direction: row;
  gap: ${p => p.theme.space(1)};
`;

const SmallerHeaderContent = styled(Layout.HeaderContent)`
  margin-bottom: ${p => p.theme.space(1.5)};
`;

const SmallerProfilingBreadcrumbsWrapper = styled('div')`
  nav {
    padding-bottom: ${p => p.theme.space(1)};
  }
`;

const SmallerLayoutHeader = styled(Layout.Header)`
  padding: ${p => p.theme.space(1)} ${p => p.theme.space(2)} 0 ${p => p.theme.space(2)} !important;
`;
