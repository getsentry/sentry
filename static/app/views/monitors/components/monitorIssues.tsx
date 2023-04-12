import {Fragment} from 'react';
import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import GroupList from 'sentry/components/issues/groupList';
import Link from 'sentry/components/links/link';
import {Panel, PanelBody} from 'sentry/components/panels';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {getUtcDateString} from 'sentry/utils/dates';
import usePageFilters from 'sentry/utils/usePageFilters';

import {Monitor, MonitorEnvironment} from '../types';

type Props = {
  monitor: Monitor;
  monitorEnv: MonitorEnvironment;
  orgId: string;
};

function MonitorIssuesEmptyMessage() {
  return (
    <Panel>
      <PanelBody>
        <EmptyStateWarning>
          <p>{t('No issues relating to this cron monitor have been found.')}</p>
        </EmptyStateWarning>
      </PanelBody>
    </Panel>
  );
}

function MonitorIssues({orgId, monitor}: Props) {
  const {selection} = usePageFilters();
  const {start, end, period} = selection.datetime;
  const timeProps =
    start && end
      ? {
          start: getUtcDateString(start),
          end: getUtcDateString(end),
        }
      : {
          statsPeriod: period,
        };

  // TODO(epurkhiser): We probably want to filter on envrionemnt

  const issueStreamLink = {
    pathname: '/issues',
    query: {query: `monitor.id:"${monitor.id}"`},
  };
  return (
    <Fragment>
      <StyledAlert type="warning" showIcon>
        {tct(
          'Some older issues may be missing from this list, visit the [link:issue stream] for older related issues.',
          {
            link: <Link to={issueStreamLink} />,
          }
        )}
      </StyledAlert>
      <GroupList
        orgId={orgId}
        endpointPath={`/organizations/${orgId}/issues/`}
        queryParams={{
          query: `monitor.slug:"${monitor.slug}"`,
          project: monitor.project.id,
          limit: 5,
          ...timeProps,
        }}
        query=""
        renderEmptyMessage={MonitorIssuesEmptyMessage}
        canSelectGroups={false}
        withPagination={false}
        withChart={false}
        useTintRow={false}
        source="monitors"
      />
    </Fragment>
  );
}

const StyledAlert = styled(Alert)`
  margin-bottom: ${space(0.5)};
`;

export default MonitorIssues;
