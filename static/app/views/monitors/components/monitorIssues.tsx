import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import GroupList from 'sentry/components/issues/groupList';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getUtcDateString} from 'sentry/utils/dates';
import usePageFilters from 'sentry/utils/usePageFilters';

import type {Monitor, MonitorEnvironment} from '../types';

enum IssuesType {
  ALL = 'all',
  UNRESOLVED = 'unresolved',
}

const ISSUE_TYPES = [
  {value: IssuesType.UNRESOLVED, label: t('Unresolved Issues')},
  {value: IssuesType.ALL, label: t('All Issues')},
];

type Props = {
  monitor: Monitor;
  monitorEnvs: MonitorEnvironment[];
  orgSlug: string;
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

export function MonitorIssues({orgSlug, monitor, monitorEnvs}: Props) {
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

  const [issuesType, setIssuesType] = useState<IssuesType>(IssuesType.UNRESOLVED);

  const monitorFilter = `monitor.slug:${monitor.slug}`;
  const envFilter = `environment:[${monitorEnvs.map(e => e.name).join(',')}]`;
  const issueTypeFilter = issuesType === IssuesType.UNRESOLVED ? 'is:unresolved' : '';
  const issueQuery = `${monitorFilter} ${envFilter} ${issueTypeFilter}`;

  const issueSearchLocation = {
    pathname: `/organizations/${orgSlug}/issues/`,
    query: {
      query: issueQuery,
      project: monitor.project.id,
      ...timeProps,
    },
  };

  // TODO(epurkhiser): We probably want to filter on envrionemnt
  return (
    <Fragment>
      <ControlsWrapper>
        <SegmentedControl
          aria-label={t('Issue category')}
          value={issuesType}
          size="xs"
          onChange={setIssuesType}
        >
          {ISSUE_TYPES.map(({value, label}) => (
            <SegmentedControl.Item key={value} textValue={label}>
              {label}
            </SegmentedControl.Item>
          ))}
        </SegmentedControl>
        <LinkButton size="xs" to={issueSearchLocation}>
          {t('Open In Issues')}
        </LinkButton>
      </ControlsWrapper>
      <GroupList
        orgSlug={orgSlug}
        queryParams={{
          query: issueQuery,
          project: monitor.project.id,
          limit: 20,
          ...timeProps,
        }}
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

const ControlsWrapper = styled('div')`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: ${space(1)};
  flex-wrap: wrap;
`;
