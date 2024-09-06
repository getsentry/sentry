import {useMemo} from 'react';
import styled from '@emotion/styled';

import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import type {ProfilingBreadcrumbsProps} from 'sentry/components/profiling/profilingBreadcrumbs';
import {ProfilingBreadcrumbs} from 'sentry/components/profiling/profilingBreadcrumbs';
import {space} from 'sentry/styles/space';
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
  gap: ${space(1)};
`;

const SmallerHeaderContent = styled(Layout.HeaderContent)`
  margin-bottom: ${space(1.5)};
`;

const SmallerProfilingBreadcrumbsWrapper = styled('div')`
  nav {
    padding-bottom: ${space(1)};
  }
`;

const SmallerLayoutHeader = styled(Layout.Header)`
  padding: ${space(1)} ${space(2)} 0 ${space(2)} !important;
`;
