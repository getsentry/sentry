import React from 'react';
import {css} from '@emotion/core';
import styled from '@emotion/styled';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {BuiltinSymbolSource, DebugFile} from 'app/types/debugFiles';
import {CandidateDownloadStatus, Image} from 'app/types/debugImage';
import theme from 'app/utils/theme';

import Address from '../address';
import NotAvailable from '../notAvailable';
import {getFileName} from '../utils';

import Candidates from './candidates';
import {INTERNAL_SOURCE} from './utils';

type Candidates = Image['candidates'];

type Props = AsyncComponent['props'] &
  ModalRenderProps & {
    projectId: Project['id'];
    organization: Organization;
    image: Image;
  };

type State = AsyncComponent['state'] & {
  debugFiles: Array<DebugFile> | null;
  builtinSymbolSources: Array<BuiltinSymbolSource> | null;
};

class DebugFileDetails extends AsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      debugFiles: [],
      builtinSymbolSources: [],
    };
  }

  getUplodedDebugFiles(candidates: Candidates) {
    return candidates.find(candidate => candidate.source === INTERNAL_SOURCE);
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, projectId, image} = this.props;
    const {debug_id, candidates = []} = image;
    const {builtinSymbolSources} = this.state || {};

    const uploadedDebugFiles = this.getUplodedDebugFiles(candidates);
    const endpoints: ReturnType<AsyncComponent['getEndpoints']> = [];

    if (uploadedDebugFiles) {
      endpoints.push([
        'debugFiles',
        `/projects/${organization.slug}/${projectId}/files/dsyms/?debug_id=${debug_id}`,
        {
          query: {
            file_formats: !!organization.features?.includes('android-mappings')
              ? ['breakpad', 'macho', 'elf', 'pe', 'pdb', 'sourcebundle']
              : undefined,
          },
        },
      ]);
    }

    if (
      !builtinSymbolSources?.length &&
      organization.features.includes('symbol-sources')
    ) {
      endpoints.push(['builtinSymbolSources', '/builtin-symbol-sources/', {}]);
    }

    return endpoints;
  }

  getCandidates() {
    const {debugFiles, loading} = this.state;
    const {image} = this.props;
    const {candidates = []} = image;

    if (!debugFiles || loading) {
      return candidates;
    }

    // Check for unapplied debug files
    const candidateLocations = new Set(
      candidates.map(candidate => candidate.location).filter(location => !!location)
    );

    const unAppliedDebugFiles = debugFiles
      .filter(debugFile => !candidateLocations.has(debugFile.id))
      .map(debugFile => ({
        download: {
          status: CandidateDownloadStatus.UNAPPLIED,
        },
        location: debugFile.id,
        source: INTERNAL_SOURCE,
        source_name: debugFile.objectName,
      }));

    // Check for deleted debug files
    const debugFileIds = new Set(debugFiles.map(debugFile => debugFile.id));

    const convertedCandidates = candidates.map(candidate => {
      if (
        candidate.source === INTERNAL_SOURCE &&
        candidate.location &&
        !debugFileIds.has(candidate.location) &&
        candidate.download.status === CandidateDownloadStatus.OK
      ) {
        return {
          ...candidate,
          download: {
            status: CandidateDownloadStatus.DELETED,
          },
        };
      }
      return candidate;
    });

    return [...convertedCandidates, ...unAppliedDebugFiles] as Candidates;
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
      this.setState({loading: false});
    }
  };

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {Header, Body, Footer, image, organization, projectId} = this.props;
    const {loading, builtinSymbolSources} = this.state;

    const {debug_id, debug_file, code_file, code_id, arch: architecture} = image;

    const candidates = this.getCandidates();
    const baseUrl = this.api.baseUrl;

    const title = getFileName(code_file);
    const imageAddress = <Address image={image} />;

    return (
      <React.Fragment>
        <Header closeButton>{title ?? t('Unknown')}</Header>
        <Body>
          <Content>
            <GeneralInfo>
              <Label>{t('Address Range')}</Label>
              <Value>{imageAddress ?? <NotAvailable />}</Value>

              <Label coloredBg>{t('Debug ID')}</Label>
              <Value coloredBg>{debug_id ?? <NotAvailable />}</Value>

              <Label>{t('Debug File')}</Label>
              <Value>{debug_file}</Value>

              <Label coloredBg>{t('Code ID')}</Label>
              <Value coloredBg>{code_id}</Value>

              <Label>{t('Code File')}</Label>
              <Value>{code_file}</Value>

              <Label coloredBg>{t('Architecture')}</Label>
              <Value coloredBg>{architecture ?? <NotAvailable />}</Value>
            </GeneralInfo>
            <Candidates
              candidates={candidates}
              organization={organization}
              projectId={projectId}
              baseUrl={baseUrl}
              onDelete={this.handleDelete}
              isLoading={loading}
              builtinSymbolSources={builtinSymbolSources}
            />
          </Content>
        </Body>
        <Footer>
          <Button
            href="https://docs.sentry.io/platforms/native/data-management/debug-files/"
            external
          >
            {t('Read the docs')}
          </Button>
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
  color: ${p => p.theme.textColor};
  ${p => p.coloredBg && `background-color: ${p.theme.backgroundSecondary};`}
  padding: ${space(1)} ${space(1.5)} ${space(1)} ${space(1)};
`;

const Value = styled(Label)`
  color: ${p => p.theme.gray400};
  ${p => p.coloredBg && `background-color: ${p.theme.backgroundSecondary};`}
  padding: ${space(1)};
  font-family: ${p => p.theme.text.familyMono};
  white-space: pre-wrap;
  word-break: break-all;
`;

export const modalCss = css`
  .modal-content {
    overflow: initial;
  }

  @media (min-width: ${theme.breakpoints[0]}) {
    .modal-dialog {
      width: 55%;
      margin-left: -27.5%;
    }
  }

  @media (min-width: ${theme.breakpoints[3]}) {
    .modal-dialog {
      width: 70%;
      margin-left: -35%;
    }
  }
`;
