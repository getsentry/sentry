import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import ErrorBoundary from 'sentry/components/errorBoundary';
import GroupList from 'sentry/components/issues/groupList';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  detectorId: string;
  query?: Record<string, any>;
}

function EmptyMessage() {
  return (
    <Panel>
      <PanelBody>
        <EmptyStateWarning small withIcon={false}>
          {t('No issues found for this monitor')}
        </EmptyStateWarning>
      </PanelBody>
    </Panel>
  );
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
          renderEmptyMessage={EmptyMessage}
          source="detector-details"
        />
      </ErrorBoundary>
    </Section>
  );
}
