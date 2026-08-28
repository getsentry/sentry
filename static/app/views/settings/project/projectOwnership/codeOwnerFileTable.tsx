import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {ExternalLink} from '@sentry/scraps/link';
import {useModal} from '@sentry/scraps/modal';
import type {TableColumnConfig} from '@sentry/scraps/table';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeSince} from 'sentry/components/timeSince';
import {IconEllipsis, IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {CodeOwner, CodeownersFile} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getCodeOwnerIcon} from 'sentry/utils/integrationUtil';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';

import {modalCss, ViewCodeOwnerModal} from './viewCodeOwnerModal';

const CODEOWNER_COLUMNS: TableColumnConfig[] = [
  {key: 'codeowners', width: '1fr'},
  {key: 'stackRoot', width: '1fr'},
  {key: 'sourceRoot', width: '1fr'},
  {key: 'lastSynced', width: 'auto'},
  {key: 'file', width: 'min-content'},
  {key: 'actions', width: 'min-content'},
];

interface CodeOwnerFileTableProps {
  codeowners: CodeOwner[];
  disabled: boolean;
  onDelete: (data: CodeOwner) => void;
  onUpdate: (data: CodeOwner) => void;
  project: Project;
}

/**
 * A list of codeowner files being used for this project
 * If you're looking for ownership rules table see `OwnershipRulesTable`
 */
export function CodeOwnerFileTable({
  codeowners,
  project,
  onUpdate,
  onDelete,
  disabled,
}: CodeOwnerFileTableProps) {
  const {openModal} = useModal();

  const api = useApi();
  const theme = useTheme();
  const organization = useOrganization();

  // Do we need an empty state instead?
  if (codeowners.length === 0) {
    return null;
  }

  const handleView = (codeowner: CodeOwner) => () => {
    // Open modal with codeowner file
    openModal(deps => <ViewCodeOwnerModal {...deps} codeowner={codeowner} />, {
      modalCss: modalCss(theme),
    });
  };

  const handleSync = (codeowner: CodeOwner) => async () => {
    try {
      const codeownerFile: CodeownersFile = await api.requestPromise(
        getApiUrl(
          '/organizations/$organizationIdOrSlug/code-mappings/$configId/codeowners/',
          {
            path: {
              organizationIdOrSlug: organization.slug,
              configId: codeowner.codeMappingId,
            },
          }
        ),
        {
          method: 'GET',
        }
      );

      const data = await api.requestPromise(
        getApiUrl(
          '/projects/$organizationIdOrSlug/$projectIdOrSlug/codeowners/$codeownersId/',
          {
            path: {
              organizationIdOrSlug: organization.slug,
              projectIdOrSlug: project.slug,
              codeownersId: codeowner.id,
            },
          }
        ),
        {
          method: 'PUT',
          data: {raw: codeownerFile.raw},
        }
      );
      onUpdate({...codeowner, ...data});
      addSuccessMessage(t('CODEOWNERS file sync successful.'));
    } catch (_err) {
      addErrorMessage(t('An error occurred trying to sync CODEOWNERS file.'));
    }
  };

  const handleDelete = (codeowner: CodeOwner) => async () => {
    try {
      await api.requestPromise(
        getApiUrl(
          '/projects/$organizationIdOrSlug/$projectIdOrSlug/codeowners/$codeownersId/',
          {
            path: {
              organizationIdOrSlug: organization.slug,
              projectIdOrSlug: project.slug,
              codeownersId: codeowner.id,
            },
          }
        ),
        {
          method: 'DELETE',
        }
      );
      onDelete(codeowner);
      addSuccessMessage(t('Deletion successful'));
    } catch {
      // no 4xx errors should happen on delete
      addErrorMessage(t('An error occurred'));
    }
  };

  return (
    <StyledSimpleTable
      columns={CODEOWNER_COLUMNS}
      header={
        <SimpleTable.HeaderRow>
          <SimpleTable.HeaderCell>{t('codeowners')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Stack Trace Root')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Source Code Root')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Last Synced')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('File')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell />
        </SimpleTable.HeaderRow>
      }
    >
      {codeowners.map(codeowner => (
        <SimpleTable.Row key={codeowner.id}>
          <SimpleTable.RowCell gap="md">
            {getCodeOwnerIcon(codeowner.provider)}
            {codeowner.codeMapping?.repoName}
          </SimpleTable.RowCell>
          <SimpleTable.RowCell gap="md">
            <code>{codeowner.codeMapping?.stackRoot}</code>
          </SimpleTable.RowCell>
          <SimpleTable.RowCell gap="md">
            <code>{codeowner.codeMapping?.sourceRoot}</code>
          </SimpleTable.RowCell>
          <SimpleTable.RowCell gap="md">
            <TimeSince date={codeowner.dateSynced ?? codeowner.dateUpdated} />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell gap="md">
            {codeowner.codeOwnersUrl === 'unknown' ? null : (
              <StyledExternalLink href={codeowner.codeOwnersUrl}>
                <IconOpen size="xs" />
                {t(
                  'View in %s',
                  codeowner.codeMapping?.provider?.name ?? codeowner.provider
                )}
              </StyledExternalLink>
            )}
          </SimpleTable.RowCell>
          <SimpleTable.RowCell gap="md">
            <DropdownMenu
              items={[
                {
                  key: 'view',
                  label: t('View'),
                  onAction: handleView(codeowner),
                },
                {
                  key: 'sync',
                  label: t('Sync'),
                  onAction: handleSync(codeowner),
                },
                {
                  key: 'delete',
                  label: t('Delete'),
                  priority: 'danger',
                  onAction: handleDelete(codeowner),
                },
              ]}
              position="bottom-end"
              triggerProps={{
                'aria-label': t('Actions'),
                size: 'xs',
                icon: <IconEllipsis />,
                showChevron: false,
                disabled,
              }}
              disabledKeys={disabled ? ['sync', 'delete'] : []}
            />
          </SimpleTable.RowCell>
        </SimpleTable.Row>
      ))}
    </StyledSimpleTable>
  );
}

const StyledSimpleTable = styled(SimpleTable)`
  position: static;
  overflow: auto;
  white-space: nowrap;
`;

const StyledExternalLink = styled(ExternalLink)`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
`;
