import {Fragment, useMemo} from 'react';
import {useMutation, useQueryClient} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {InfoTip} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {InfiniteTable} from 'sentry/components/infiniteTable/infiniteTable';
import type {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import {PreferredAgentDropdownMenu} from 'sentry/components/seer/preferredAgent';
import {StoppingPointDropdownMenu} from 'sentry/components/seer/stoppingPoint';
import {t, tct, tn} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Sort} from 'sentry/utils/discover/fields';
import {ListItemSelectedState} from 'sentry/utils/list/listItemSelectedState';
import {ListSelectAllCheckbox} from 'sentry/utils/list/listSelectAllCheckbox';
import {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';
import {useKnownAgents} from 'sentry/utils/seer/preferredAgent';
import {getMutateSeerProjectsSettingsOptions} from 'sentry/utils/seer/seerProjectSettings';
import type {SeerProjectSettingResponse} from 'sentry/utils/seer/types';
import {useOrganization} from 'sentry/utils/useOrganization';

import {useCanWriteSettings} from 'getsentry/views/seerAutomation/components/useCanWriteSettings';

interface Props {
  mutableSearch: MutableSearch;
  onSortClick: (key: Sort) => void;
  settings: SeerProjectSettingResponse[];
  sort: Sort;
}

const COLUMNS = [
  {title: t('Project'), key: 'project', sortKey: 'name'},
  {title: t('Repos'), key: 'repos', sortKey: 'reposCount'},
  {
    title: ({organization}: {organization: Organization}) => (
      <Flex gap="sm" align="center">
        {t('Handoff to Agent')}
        <InfoTip
          title={tct(
            'Select the coding agent to use when proposing code changes. [manageLink:Manage Coding Agent Integrations]',
            {
              manageLink: (
                <Link
                  to={{
                    pathname: `/settings/${organization.slug}/integrations/`,
                    query: {category: 'coding agent'},
                  }}
                >
                  {t('Manage Coding Agent Integrations')}
                </Link>
              ),
            }
          )}
        />
      </Flex>
    ),
    key: 'fixes',
    sortKey: 'agent',
  },
  {
    title: (
      <Flex gap="sm" align="center">
        {t('Automation Steps')}
        <InfoTip
          title={t(
            'Choose which steps Seer should run automatically on issues. Depending on how actionable the issue is, Seer may stop at an earlier step.'
          )}
        />
      </Flex>
    ),
    key: 'automation_steps',
    sortKey: 'stoppingPoint',
  },
];

export function ProjectTableHeader({mutableSearch, onSortClick, settings, sort}: Props) {
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const canWrite = useCanWriteSettings();

  const listItemCheckboxState = useListItemCheckboxContext();
  const {countSelected, endpointOptionsRef, selectAll, selectedIds} =
    listItemCheckboxState;
  const endpointOptions = endpointOptionsRef.current;
  const rawQuery = endpointOptions?.query?.query;
  const queryString = typeof rawQuery === 'string' ? rawQuery : undefined;

  const projectIds = useMemo(
    () =>
      selectedIds === 'all' ? settings.map(setting => setting.projectId) : selectedIds,
    [settings, selectedIds]
  );

  const knownAgents = useKnownAgents();

  const {mutate} = useMutation(
    getMutateSeerProjectsSettingsOptions({
      organization,
      queryClient,
      knownAgents,
    })
  );

  return (
    <Fragment>
      <ListItemSelectedState selected="none">
        <InfiniteTable.Header>
          <InfiniteTable.HeaderCell>
            <ListSelectAllCheckbox
              data={settings}
              listItemCheckboxState={listItemCheckboxState}
            />
          </InfiniteTable.HeaderCell>
          {COLUMNS.map(({title, key, sortKey}) => (
            <InfiniteTable.HeaderCell
              key={key}
              handleSortClick={
                sortKey
                  ? () =>
                      onSortClick({
                        field: sortKey,
                        kind:
                          sortKey === sort.field
                            ? sort.kind === 'asc'
                              ? 'desc'
                              : 'asc'
                            : 'desc',
                      })
                  : undefined
              }
              sort={sort?.field === sortKey ? sort.kind : undefined}
            >
              {typeof title === 'function' ? title({organization}) : title}
            </InfiniteTable.HeaderCell>
          ))}
        </InfiniteTable.Header>
      </ListItemSelectedState>

      <ListItemSelectedState selected="indeterminate-or-all">
        <InfiniteTable.Header>
          <InfiniteTable.HeaderCellFirst>
            <ListSelectAllCheckbox
              data={settings}
              listItemCheckboxState={listItemCheckboxState}
            />
          </InfiniteTable.HeaderCellFirst>
          <InfiniteTable.HeaderCellRemaining align="center" gap="md">
            <PreferredAgentDropdownMenu
              isDisabled={!canWrite}
              onChange={value => {
                mutate(
                  {
                    query: mutableSearch.formatString(),
                    selectedIds,
                    agent: value,
                  },
                  {
                    onError: () =>
                      addErrorMessage(
                        tn(
                          'Failed to update agent for %s project',
                          'Failed to update agent for %s projects',
                          projectIds.length
                        )
                      ),
                    onSuccess: () =>
                      addSuccessMessage(
                        tn(
                          'Agent updated for %s project',
                          'Agent updated for %s projects',
                          projectIds.length
                        )
                      ),
                  }
                );
              }}
            />
            <StoppingPointDropdownMenu
              isDisabled={!canWrite}
              onChange={value => {
                mutate(
                  {
                    query: mutableSearch.formatString(),
                    selectedIds,
                    stoppingPoint: value,
                  },
                  {
                    onError: () =>
                      addErrorMessage(
                        tn(
                          'Failed to update stopping point for %s project',
                          'Failed to update stopping point for %s projects',
                          projectIds.length
                        )
                      ),
                    onSuccess: () =>
                      addSuccessMessage(
                        tn(
                          'Stopping point updated for %s project',
                          'Stopping point updated for %s projects',
                          projectIds.length
                        )
                      ),
                  }
                );
              }}
            />
          </InfiniteTable.HeaderCellRemaining>
        </InfiniteTable.Header>
      </ListItemSelectedState>

      <ListItemSelectedState selected="indeterminate">
        <Alert variant="info" system>
          <Flex justify="start" width="100%" wrap="wrap" gap="md">
            {tn('Selected %s project.', 'Selected %s projects.', countSelected)}
            <a onClick={selectAll}>
              {queryString
                ? tct('Select all [count] projects that match: [queryString].', {
                    count: listItemCheckboxState.hits,
                    queryString: <var>{queryString}</var>,
                  })
                : t('Select all %s projects.', listItemCheckboxState.hits)}
            </a>
          </Flex>
        </Alert>
      </ListItemSelectedState>

      <ListItemSelectedState selected="all">
        <Alert variant="info" system>
          {queryString
            ? tct('Selected all [count] projects matching: [queryString].', {
                count: countSelected,
                queryString: <var>{queryString}</var>,
              })
            : countSelected > settings.length
              ? t('Selected all %s+ projects.', settings.length)
              : tn('Selected %s project.', 'Selected all %s projects.', countSelected)}
        </Alert>
      </ListItemSelectedState>
    </Fragment>
  );
}
