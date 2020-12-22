import React from 'react';
import {css} from '@emotion/core';
import styled from '@emotion/styled';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import TextOverflow from 'app/components/textOverflow';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {DebugFile} from 'app/types/debugFiles';
import {CandidateDownloadStatus, Image} from 'app/types/debugImage';
import theme from 'app/utils/theme';

import NotAvailable from './notAvailable';
import Table from './table';
import {INTERNAL_SOURCE_NAME} from './utils';

type Candidates = Image['candidates'];

type Props = AsyncComponent['props'] &
  ModalRenderProps & {
    projectId: Project['id'];
    organization: Organization;
    image: Image;
    imageStartAddress: React.ReactElement | null;
    imageEndAddress: React.ReactElement | null;
    title?: string;
  };

type State = AsyncComponent['state'] & {
  debugFiles: Array<DebugFile> | null;
};

class DebugFileDetails extends AsyncComponent<Props, State> {
  getDefaultState() {
    const state = super.getDefaultState();
    return {
      ...state,
      debugFiles: [],
    };
  }

  getUplodedDebugFiles(candidates: Candidates) {
    return candidates.find(candidate => candidate.source === INTERNAL_SOURCE_NAME);
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, projectId, image} = this.props;
    const {debug_id, candidates = []} = image;

    const uploadedDebugFiles = this.getUplodedDebugFiles(candidates);

    if (!uploadedDebugFiles) {
      return [];
    }

    return [
      [
        'debugFiles',
        `/projects/${organization.slug}/${projectId}/files/dsyms/?debug_id=${debug_id}`,
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

  getCandidates() {
    const {debugFiles, loading} = this.state;
    const {image} = this.props;
    const {candidates = []} = image;

    if (!debugFiles || loading) {
      return candidates;
    }

    return candidates.map(candidate => {
      if (!debugFiles.find(debugFile => debugFile.id === candidate.location)) {
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

  handleDelete = async (debugId: string) => {
    const {organization, projectId} = this.props;

    this.setState({loading: true});

    try {
      await this.api.requestPromise(
        `/projects/${organization.slug}/${projectId}/files/dsyms/?id=${debugId}`,
        {method: 'DELETE'}
      );
      this.fetchData();
    } catch {
      addErrorMessage(t('An error occurred while deleting the debug file.'));
    }
  };

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {
      Header,
      Body,
      Footer,
      closeModal,
      title,
      image,
      imageStartAddress,
      imageEndAddress,
      organization,
      projectId,
    } = this.props;
    const {loading} = this.state;

    const {debug_id, arch: architecture, code_file, code_id} = image;

    const candidates = this.getCandidates();
    const baseUrl = this.api.baseUrl;

    return (
      <React.Fragment>
        <Header closeButton>{title ?? t('Unknown')}</Header>
        <Body>
          <Content>
            <GeneralInfo>
              <Label>{t('Address Range')}</Label>
              <Value>
                {imageStartAddress && imageEndAddress ? (
                  <React.Fragment>
                    {imageStartAddress}
                    {' \u2013 '}
                    {imageEndAddress}
                  </React.Fragment>
                ) : (
                  <NotAvailable />
                )}
              </Value>

              <Label coloredBg>{t('Debug ID')}</Label>
              <Value coloredBg>{debug_id}</Value>

              <Label>{t('Code ID')}</Label>
              <Value>{code_id}</Value>

              <Label coloredBg>{t('Code File')}</Label>
              <Value coloredBg>{code_file}</Value>

              <Label>{t('Architecture')}</Label>
              <Value>{architecture ?? <NotAvailable />}</Value>
            </GeneralInfo>
            <Table
              candidates={candidates}
              organization={organization}
              projectId={projectId}
              baseUrl={baseUrl}
              onDelete={this.handleDelete}
              isLoading={loading}
            />
          </Content>
        </Body>
        <Footer>
          <ButtonBar gap={1}>
            <Button
              href="https://docs.sentry.io/platforms/native/data-management/debug-files/"
              target="_blank"
            >
              {'Read the docs'}
            </Button>
            <Button onClick={closeModal}>{t('Close')}</Button>
          </ButtonBar>
        </Footer>
      </React.Fragment>
    );
  }
}

export default DebugFileDetails;

const Content = styled('div')`
  display: grid;
  grid-gap: ${space(4)};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const GeneralInfo = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
`;

const Label = styled('div')<{coloredBg?: boolean}>`
  color: ${p => p.theme.gray500};
  ${p => p.coloredBg && `background-color: ${p.theme.backgroundSecondary};`}
  padding: ${space(1)};
`;

const Value = styled(TextOverflow)<{coloredBg?: boolean}>`
  color: ${p => p.theme.gray400};
  ${p => p.coloredBg && `background-color: ${p.theme.backgroundSecondary};`}
  padding: ${space(1)};
  font-family: ${p => p.theme.text.familyMono};
`;

export const modalCss = css`
  .modal-content {
    overflow: initial;
  }

  @media (min-width: ${theme.breakpoints[0]}) {
    .modal-dialog {
      width: 60%;
      margin-left: -30%;
    }
  }
`;
