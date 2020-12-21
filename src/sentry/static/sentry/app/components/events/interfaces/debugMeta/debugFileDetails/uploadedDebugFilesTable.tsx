import React from 'react';

import Access from 'app/components/acl/access';
import Role from 'app/components/acl/role';
import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import Confirm from 'app/components/confirm';
import Tooltip from 'app/components/tooltip';
import {IconDelete, IconDownload} from 'app/icons';
import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import {DebugFile} from 'app/types/debugFiles';
import {CandidateDownloadStatus} from 'app/types/debugImage';

import Table from './table';

type Candidates = React.ComponentProps<typeof Table>['candidates'];

type Props = AsyncComponent['props'] & {
  organization: Organization;
  projectId: Project['id'];
  debugId: string;
  candidates: Candidates;
};

type State = AsyncComponent['state'] & {
  debugFiles: Array<DebugFile> | null;
};

class UplodadedDebugFilesTable extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, projectId, debugId} = this.props;

    return [
      [
        'debugFiles',
        `/projects/${organization.slug}/${projectId}/files/dsyms/?debug_id=${debugId}`,
        {
          query: {
            file_formats: !!organization.features?.includes('android-mappings')
              ? ['breakpad', 'macho', 'elf', 'pe', 'pdb', 'sourcebundle']
              : undefined,
          },
        },
      ],
    ];
  }

  handleDelete = (debugId: string) => {
    const {organization, projectId} = this.props;

    this.setState({loading: true});

    this.api.request(
      `/projects/${organization.slug}/${projectId}/files/dsyms/?id=${debugId}`,
      {
        method: 'DELETE',
        complete: () => this.fetchData(),
      }
    );
  };

  getCandidates() {
    const {debugFiles} = this.state;
    const {candidates} = this.props;

    return candidates.map(candidate => {
      if (!(debugFiles ?? []).find(debugFile => debugFile.id === candidate.location)) {
        return {
          ...candidate,
          download: {
            status: CandidateDownloadStatus.DELETED,
            details: t('This file was deleted'),
          },
        };
      }
      return candidate;
    }) as Candidates;
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {organization, projectId} = this.props;
    const {loading} = this.state;

    const candidates = this.getCandidates();

    return (
      <Table
        title={t('Uploaded Debug Files')}
        description="this is a description"
        candidates={candidates}
        emptyMessage={t("You haven't uploaded any debug file")}
        isLoading={loading}
        actions={({debugId, deleted}) => {
          const actions = (
            <ButtonBar gap={0.5}>
              <Role role={organization.debugFilesRole} organization={organization}>
                {({hasRole}) => (
                  <Tooltip
                    disabled={hasRole}
                    title={t('You do not have permission to download debug files.')}
                  >
                    <Button
                      size="xsmall"
                      icon={<IconDownload size="xs" />}
                      href={`${this.api.baseUrl}/projects/${organization.slug}/${projectId}/files/dsyms/?id=${debugId}`}
                      disabled={!hasRole || deleted}
                    >
                      {t('Download')}
                    </Button>
                  </Tooltip>
                )}
              </Role>
              <Access access={['project:write']} organization={organization}>
                {({hasAccess}) => (
                  <Tooltip
                    disabled={hasAccess}
                    title={t('You do not have permission to delete debug files.')}
                  >
                    <Confirm
                      confirmText={t('Delete')}
                      message={t('Are you sure you wish to delete this file?')}
                      onConfirm={() => this.handleDelete(debugId)}
                      disabled={!hasAccess || deleted}
                    >
                      <Button
                        priority="danger"
                        icon={<IconDelete size="xs" />}
                        size="xsmall"
                        disabled={!hasAccess || deleted}
                      />
                    </Confirm>
                  </Tooltip>
                )}
              </Access>
            </ButtonBar>
          );

          if (!deleted) {
            return actions;
          }

          return <Tooltip title={t('Actions not available.')}>{actions}</Tooltip>;
        }}
      />
    );
  }
}

export default UplodadedDebugFilesTable;
