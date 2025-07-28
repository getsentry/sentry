import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import ErrorBoundary from 'sentry/components/errorBoundary';
import GroupList from 'sentry/components/issues/groupList';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  detectorId: string;
  query?: Record<string, any>;
}

export function DetectorDetailsOngoingIssues({detectorId, query}: Props) {
  const organization = useOrganization();

  const queryParams = {
    ...query,
    query: new MutableSearch(['is:unresolved', `detector:${detectorId}`]).formatString(),
    limit: 5,
  };

  const issueSearch = {
    pathname: `/organizations/${organization.slug}/issues/`,
    query: queryParams,
  };

  return (
    <Section
      title={
        <Flex justify={'between'} align="center">
          {t('Ongoing Issues')}
          <LinkButton size="xs" to={issueSearch}>
            {t('View All')}
          </LinkButton>
        </Flex>
      }
    >
      <ErrorBoundary mini>
        <GroupList
          endpointPath={`/organizations/${organization.slug}/issues/`}
          queryParams={queryParams}
          canSelectGroups={false}
          withPagination={false}
          withChart={false}
          source="detector-details"
        />
      </ErrorBoundary>
    </Section>
  );
}
