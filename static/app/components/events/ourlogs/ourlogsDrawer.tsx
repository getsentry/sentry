import {useRef} from 'react';
import styled from '@emotion/styled';

import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {
  CrumbContainer,
  EventDrawerBody,
  EventDrawerContainer,
  EventDrawerHeader,
  EventNavigator,
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
import {LogsInfiniteTable} from 'sentry/views/explore/logs/tables/logsInfiniteTable';
import {TraceItemDataset} from 'sentry/views/explore/types';

interface LogIssueDrawerProps {
  event: Event;
  group: Group;
  project: Project;
  embeddedOptions?: {
    openWithExpandedIds?: string[];
  };
}

export function OurlogsDrawer({
  event,
  project,
  group,
  embeddedOptions,
}: LogIssueDrawerProps) {
  const setLogsSearch = useSetLogsSearch();
  const logsSearch = useLogsSearch();

  const {attributes: stringAttributes, secondaryAliases: stringSecondaryAliases} =
    useTraceItemAttributes('string');
  const {attributes: numberAttributes, secondaryAliases: numberSecondaryAliases} =
    useTraceItemAttributes('number');

  const tracesItemSearchQueryBuilderProps = {
    initialQuery: logsSearch.formatString(),
    searchSource: 'ourlogs',
    onSearch: (query: string) => setLogsSearch(new MutableSearch(query)),
    numberAttributes,
    stringAttributes,
    itemType: TraceItemDataset.LOGS,
    numberSecondaryAliases,
    stringSecondaryAliases,
  };
  const searchQueryBuilderProps = useSearchQueryBuilderProps(
    tracesItemSearchQueryBuilderProps
  );
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <SearchQueryBuilderProvider {...searchQueryBuilderProps}>
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
        <EventNavigator>
          <TraceItemSearchQueryBuilder {...tracesItemSearchQueryBuilderProps} />
        </EventNavigator>
        <EventDrawerBody ref={containerRef}>
          <LogsTableContainer>
            <LogsInfiniteTable
              embedded
              scrollContainer={containerRef}
              embeddedOptions={embeddedOptions}
            />
          </LogsTableContainer>
        </EventDrawerBody>
      </EventDrawerContainer>
    </SearchQueryBuilderProvider>
  );
}

const LogsTableContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;
