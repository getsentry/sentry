import {Fragment} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import ExternalLink from 'sentry/components/links/externalLink';
import PanelTable from 'sentry/components/panels/panelTable';
import TimeSince from 'sentry/components/timeSince';
import {IconEllipsis, IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {CodeOwner, CodeownersFile, Project} from 'sentry/types';
import {getCodeOwnerIcon} from 'sentry/utils/integrationUtil';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import ViewCodeOwnerModal, {modalCss} from './viewCodeOwnerModal';

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
  const api = useApi();
  const organization = useOrganization();

  // Do we need an empty state instead?
  if (codeowners.length === 0) {
    return null;
  }

  const handleView = (codeowner: CodeOwner) => () => {
    // Open modal with codeowner file
    openModal(deps => <ViewCodeOwnerModal {...deps} codeowner={codeowner} />, {modalCss});
  };

  const handleSync = (codeowner: CodeOwner) => async () => {
    try {
      const codeownerFile: CodeownersFile = await api.requestPromise(
        `/organizations/${organization.slug}/code-mappings/${codeowner.codeMappingId}/codeowners/`,
        {
          method: 'GET',
        }
      );

      const data = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/codeowners/${codeowner.id}/`,
        {
          method: 'PUT',
          data: {raw: codeownerFile.raw, date_updated: new Date().toISOString()},
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
        `/projects/${organization.slug}/${project.slug}/codeowners/${codeowner.id}/`,
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
    <StyledPanelTable
      headers={[
        t('codeowners'),
        t('Stack Trace Root'),
        t('Source Code Root'),
        t('Last Synced'),
        t('File'),
        '',
      ]}
    >
      {codeowners.map(codeowner => (
        <Fragment key={codeowner.id}>
          <FlexCenter>
            {getCodeOwnerIcon(codeowner.provider)}
            {codeowner.codeMapping?.repoName}
          </FlexCenter>
          <FlexCenter>
            <code>{codeowner.codeMapping?.stackRoot}</code>
          </FlexCenter>
          <FlexCenter>
            <code>{codeowner.codeMapping?.sourceRoot}</code>
          </FlexCenter>
          <FlexCenter>
            <TimeSince date={codeowner.dateUpdated} />
          </FlexCenter>
          <FlexCenter>
            {codeowner.codeOwnersUrl === 'unknown' ? null : (
              <StyledExternalLink href={codeowner.codeOwnersUrl}>
                <IconOpen size="xs" />
                {t(
                  'View in %s',
                  codeowner.codeMapping?.provider?.name ?? codeowner.provider
                )}
              </StyledExternalLink>
            )}
          </FlexCenter>
          <FlexCenter>
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
          </FlexCenter>
        </Fragment>
      ))}
    </StyledPanelTable>
  );
}

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr 1fr 1fr auto min-content min-content;
  position: static;
  overflow: auto;
  white-space: nowrap;
`;

const FlexCenter = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const StyledExternalLink = styled(ExternalLink)`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
