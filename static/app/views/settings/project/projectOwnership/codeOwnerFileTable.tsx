import {Fragment} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {PanelTable} from 'sentry/components/panels';
import TimeSince from 'sentry/components/timeSince';
import {IconEllipsis, IconGithub, IconGitlab, IconSentry} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import type {CodeOwner, CodeownersFile, Project} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface CodeOwnerFileTableProps {
  codeowners: CodeOwner[];
  disabled: boolean;
  onDelete: (data: CodeOwner) => void;
  onUpdate: (data: CodeOwner) => void;
  project: Project;
}

function CodeownerIcon({provider}: {provider: CodeOwner['provider']}) {
  switch (provider ?? '') {
    case 'github':
      return <IconGithub size="md" />;
    case 'gitlab':
      return <IconGitlab size="md" />;
    default:
      return <IconSentry size="md" />;
  }
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
    <StyledPanelTable headers={[t('codeowners'), t('Last Synced'), '']}>
      {codeowners.map(codeowner => (
        <Fragment key={codeowner.id}>
          <FlexCenter>
            <CodeownerIcon provider={codeowner.provider} />
            {codeowner.codeMapping?.repoName}
          </FlexCenter>
          <FlexCenter>
            <TimeSince date={codeowner.dateUpdated} />
          </FlexCenter>
          <FlexCenter>
            <DropdownMenu
              items={[
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
                icon: <IconEllipsis size="xs" />,
                showChevron: false,
                disabled,
              }}
              isDisabled={disabled}
            />
          </FlexCenter>
        </Fragment>
      ))}
    </StyledPanelTable>
  );
}

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr auto min-content;
  position: static;
  overflow: auto;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    overflow: initial;
  }
`;

const FlexCenter = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
