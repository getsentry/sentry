import {Fragment, useState} from 'react';
import {skipToken, useQuery} from '@tanstack/react-query';
import {PlatformIcon} from 'platformicons';

import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Pagination, useGetPaginationCaption} from '@sentry/scraps/pagination';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {DateTime} from 'sentry/components/dateTime';
import {Placeholder} from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {AlertPreviewResponse} from 'sentry/types/workflowEngine/automations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getPaginationPageLink} from 'sentry/views/organizationStats/utils';

const PREVIEW_COLUMNS: TableColumnConfig[] = [
  {key: 'lastTriggered', width: '2fr'},
  {key: 'issue', width: '4fr'},
  {key: 'alerts', width: '1fr'},
];

const PREVIEW_PAGE_SIZE = 10;

interface AlertPreviewRow {
  alertCount: number;
  groupId: string;
  lastTriggered: string;
}

function getAlertPreviewRows(previews: AlertPreviewResponse[]): AlertPreviewRow[] {
  const rows = new Map<string, AlertPreviewRow>();

  for (const {results} of previews) {
    for (const result of results) {
      if (result.isThrottled) {
        continue;
      }

      const existing = rows.get(result.groupId);
      rows.set(result.groupId, {
        groupId: result.groupId,
        alertCount: (existing?.alertCount ?? 0) + 1,
        lastTriggered:
          existing && existing.lastTriggered > result.triggeredAt
            ? existing.lastTriggered
            : result.triggeredAt,
      });
    }
  }

  return [...rows.values()].sort((left, right) =>
    right.lastTriggered.localeCompare(left.lastTriggered)
  );
}

function PreviewSkeletons() {
  return (
    <Fragment>
      {Array.from({length: 3}).map((_, index) => (
        <SimpleTable.Row key={index}>
          {PREVIEW_COLUMNS.map(column => (
            <SimpleTable.RowCell key={column.key}>
              <Placeholder height="20px" />
            </SimpleTable.RowCell>
          ))}
        </SimpleTable.Row>
      ))}
    </Fragment>
  );
}

interface Props {
  isLoading: boolean;
  projectIds: number[];
  previews?: AlertPreviewResponse[];
}

export function AutomationAlertPreviewTable({
  isLoading: isPreviewLoading,
  projectIds,
  previews,
}: Props) {
  const organization = useOrganization();
  const [page, setPage] = useState(0);
  const getPaginationCaption = useGetPaginationCaption();
  const rows = getAlertPreviewRows(previews ?? []);
  const offset = page * PREVIEW_PAGE_SIZE;
  const pageRows = rows.slice(offset, offset + PREVIEW_PAGE_SIZE);
  const groupIds = pageRows.map(row => row.groupId);
  const {
    data: groups = [],
    isError: isGroupsError,
    isPending: isGroupsPending,
  } = useQuery(
    apiOptions.as<Array<Pick<Group, 'id' | 'title' | 'project'>>>()(
      '/organizations/$organizationIdOrSlug/issues/',
      {
        path: groupIds.length ? {organizationIdOrSlug: organization.slug} : skipToken,
        query: {
          group: groupIds,
          project: projectIds,
          collapse: ['stats', 'unhandled'],
        },
        staleTime: 30_000,
      }
    )
  );
  const groupsById = new Map(groups.map(group => [group.id, group]));

  const isLoading = isPreviewLoading || (rows.length > 0 && isGroupsPending);

  return (
    <Fragment>
      <SimpleTable
        columns={PREVIEW_COLUMNS}
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>{t('Last Triggered')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell>{t('Issue')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell align="right">{t('Alerts')}</SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      >
        {isLoading && <PreviewSkeletons />}
        {!isLoading && isGroupsError && <SimpleTable.Error />}
        {!isLoading && !isGroupsError && rows.length === 0 && (
          <SimpleTable.Empty>{t('No matching alerts found')}</SimpleTable.Empty>
        )}
        {!isLoading &&
          !isGroupsError &&
          pageRows.map(row => {
            const group = groupsById.get(row.groupId);
            return (
              <SimpleTable.Row key={row.groupId}>
                <SimpleTable.RowCell>
                  <DateTime date={row.lastTriggered} timeZone />
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>
                  <Link
                    to={{
                      pathname: `/organizations/${organization.slug}/issues/${row.groupId}/`,
                      query: group ? {project: group.project.id} : undefined,
                    }}
                  >
                    <Flex gap="xs" align="center" minWidth="0">
                      {group && (
                        <PlatformIcon
                          platform={group.project.platform ?? 'default'}
                          size={16}
                          alt=""
                        />
                      )}
                      <Text ellipsis>{group?.title ?? `#${row.groupId}`}</Text>
                    </Flex>
                  </Link>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell justify="end">{row.alertCount}</SimpleTable.RowCell>
              </SimpleTable.Row>
            );
          })}
      </SimpleTable>
      {rows.length > PREVIEW_PAGE_SIZE && (
        <Pagination
          disabled={isLoading || isGroupsError}
          pageLinks={getPaginationPageLink({
            numRows: rows.length,
            pageSize: PREVIEW_PAGE_SIZE,
            offset,
          })}
          caption={getPaginationCaption({
            cursor: `0:${page}:0`,
            limit: PREVIEW_PAGE_SIZE,
            pageLength: pageRows.length,
            total: rows.length,
          })}
          onCursor={(_cursor, _path, _query, delta) => setPage(page + delta)}
        />
      )}
    </Fragment>
  );
}
