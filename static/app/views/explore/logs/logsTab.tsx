import {useCallback} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import {IconTable} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TagCollection} from 'sentry/types/group';
import {
  useLogsFields,
  useLogsSearch,
  useSetLogsFields,
  useSetLogsQuery,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LogsTable} from 'sentry/views/explore/logs/logsTable';
import {useExploreLogsTable} from 'sentry/views/explore/logs/useLogsQuery';
import {ColumnEditorModal} from 'sentry/views/explore/tables/columnEditorModal';
import type {DefaultPeriod, MaxPickableDays} from 'sentry/views/explore/utils';

export type LogsTabProps = {
  defaultPeriod: DefaultPeriod;
  maxPickableDays: MaxPickableDays;
  relativeOptions: Record<string, React.ReactNode>;
};

export function LogsTabContent({
  defaultPeriod,
  maxPickableDays,
  relativeOptions,
}: LogsTabProps) {
  const setLogsQuery = useSetLogsQuery();
  const logsSearch = useLogsSearch();
  const fields = useLogsFields();
  const setFields = useSetLogsFields();
  const tableData = useExploreLogsTable({});
  const openColumnEditor = useCallback(() => {
    openModal(
      modalProps => (
        <ColumnEditorModal
          {...modalProps}
          columns={fields}
          onColumnsChange={setFields}
          stringTags={[] as unknown as TagCollection}
          numberTags={[] as unknown as TagCollection}
        />
      ),
      {closeEvents: 'escape-key'}
    );
  }, [fields, setFields]);
  return (
    <Layout.Body>
      <Layout.Main fullWidth>
        <FilterBarContainer>
          <PageFilterBar condensed>
            <ProjectPageFilter />
            <EnvironmentPageFilter />
            <DatePageFilter
              defaultPeriod={defaultPeriod}
              maxPickableDays={maxPickableDays}
              relativeOptions={({arbitraryOptions}) => ({
                ...arbitraryOptions,
                ...relativeOptions,
              })}
            />
          </PageFilterBar>
          <SearchQueryBuilder
            placeholder={t('Search for logs')}
            filterKeys={{}}
            getTagValues={() => new Promise<string[]>(() => [])}
            initialQuery={logsSearch.formatString()}
            searchSource="ourlogs"
            onSearch={setLogsQuery}
          />

          <Button onClick={openColumnEditor} icon={<IconTable />}>
            {t('Edit Table')}
          </Button>
        </FilterBarContainer>
      </Layout.Main>

      <LogsTableContainer fullWidth>
        <LogsTable tableData={tableData} />
      </LogsTableContainer>
    </Layout.Body>
  );
}

const FilterBarContainer = styled('div')`
  display: flex;
  gap: ${space(2)};
`;

const LogsTableContainer = styled(Layout.Main)`
  margin-top: ${space(2)};
`;
