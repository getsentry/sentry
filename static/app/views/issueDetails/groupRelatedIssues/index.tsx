import {Fragment} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import {GroupList} from 'sentry/components/issues/groupList';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {useOrganization} from 'sentry/utils/useOrganization';

import {relatedIssuesApiOptions, type SameTraceMeta} from './relatedIssuesApiOptions';

// The endpoint's maximum. The trace lookup reads up to 100 error events.
const SAME_TRACE_LIMIT = 100;

function GroupRelatedIssues({group}: {group: Group}) {
  const organization = useOrganization();
  const {isPending, isError, data, refetch} = useQuery(
    relatedIssuesApiOptions({
      organization,
      groupId: group.id,
      types: ['same_trace'],
      limit: SAME_TRACE_LIMIT,
    })
  );

  if (isPending) {
    return <LoadingIndicator />;
  }
  if (isError) {
    return (
      <LoadingError
        message={t('Unable to load related issues, please try again later')}
        onRetry={refetch}
      />
    );
  }

  const sameTrace = data.meta.types.find(
    (entry): entry is SameTraceMeta => entry.type === 'same_trace'
  );
  const issueIds = data.data.map(({issue}) => issue.id);
  if (!sameTrace?.traceId || !sameTrace.eventId || issueIds.length === 0) {
    return null;
  }

  const traceUrl = `/organizations/${organization.slug}/performance/trace/${sameTrace.traceId}/?node=error-${sameTrace.eventId}`;
  return (
    <Fragment>
      <HeaderWrapper>
        <Title>{t('Issues in the same trace')}</Title>
        <Flex justify="between" align="center" marginBottom="md" width="100%">
          <span>
            <small>
              {tct('These issues were all found within [traceLink:this trace]', {
                traceLink: <Link to={traceUrl}>{t('this trace')}</Link>,
              })}
            </small>
          </span>
          <LinkButton
            to={{
              pathname: `/organizations/${organization.slug}/issues/`,
              query: {
                // project=-1 shows issues from every project, since a trace can cross projects
                project: '-1',
                query: `trace:${sameTrace.traceId}`,
              },
            }}
            size="xs"
            analyticsEventName="Clicked Open Issues from trace-connected related issues"
            analyticsEventKey="similar_issues.trace_connected_issues_clicked_open_issues"
          >
            {t('Open in Issues')}
          </LinkButton>
        </Flex>
      </HeaderWrapper>
      <GroupList
        queryParams={{query: `issue.id:[${issueIds}]`}}
        source="similar-issues-tab"
        canSelectGroups={false}
        withChart={false}
        withColumns={['event', 'firstSeen', 'lastSeen']}
        numPlaceholderRows={4}
      />
    </Fragment>
  );
}

// Export the component without feature flag controls
export {GroupRelatedIssues};

const Title = styled('h4')`
  font-size: ${p => p.theme.font.size.lg};
  margin-bottom: ${p => p.theme.space.sm};
`;

const HeaderWrapper = styled('div')`
  margin-bottom: ${p => p.theme.space.xl};

  small {
    color: ${p => p.theme.tokens.content.secondary};
  }
`;
