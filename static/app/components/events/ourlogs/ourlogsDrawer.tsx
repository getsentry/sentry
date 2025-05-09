import styled from '@emotion/styled';

import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {
  CrumbContainer,
  EventDrawerBody,
  EventDrawerContainer,
  EventDrawerHeader,
  NavigationCrumbs,
  ShortId,
} from 'sentry/components/events/eventDrawer';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getShortEventId} from 'sentry/utils/events';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {
  TraceItemSearchQueryBuilder,
  useSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {
  useLogsSearch,
  useSetLogsSearch,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {useTraceItemAttributes} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {LogsTable} from 'sentry/views/explore/logs/logsTable';
import {useExploreLogsTable} from 'sentry/views/explore/logs/useLogsQuery';
import {TraceItemDataset} from 'sentry/views/explore/types';

interface LogIssueDrawerProps {
  event: Event;
  group: Group;
  project: Project;
}

export function OurlogsDrawer({event, project, group}: LogIssueDrawerProps) {
  const setLogsSearch = useSetLogsSearch();
  const logsSearch = useLogsSearch();
  const tableData = useExploreLogsTable({});
  const {attributes: stringAttributes} = useTraceItemAttributes('string');
  const {attributes: numberAttributes} = useTraceItemAttributes('number');

  const tracesItemSearchQueryBuilderProps = {
    initialQuery: logsSearch.formatString(),
    searchSource: 'ourlogs',
    onSearch: (query: string) => setLogsSearch(new MutableSearch(query)),
    numberAttributes,
    stringAttributes,
    itemType: TraceItemDataset.LOGS,
  };
  const searchQueryBuilderProps = useSearchQueryBuilderProps(
    tracesItemSearchQueryBuilderProps
  );

  return (
    <EventDrawerContainer>
      <EventDrawerHeader>
        <NavigationCrumbs
          crumbs={[
            {
              label: (
                <CrumbContainer>
                  <ProjectAvatar project={project} />
                  <ShortId>{group.shortId}</ShortId>
                </CrumbContainer>
              ),
            },
            {label: getShortEventId(event.id)},
            {label: t('Logs')},
          ]}
        />
      </EventDrawerHeader>
      <EventDrawerBody>
        <SearchQueryBuilderProvider {...searchQueryBuilderProps}>
          <LogsTableContainer>
            <TraceItemSearchQueryBuilder {...tracesItemSearchQueryBuilderProps} />
            <LogsTable showHeader={false} allowPagination tableData={tableData} />
          </LogsTableContainer>
        </SearchQueryBuilderProvider>
      </EventDrawerBody>
    </EventDrawerContainer>
  );
}

const LogsTableContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  height: 100%;
`;
