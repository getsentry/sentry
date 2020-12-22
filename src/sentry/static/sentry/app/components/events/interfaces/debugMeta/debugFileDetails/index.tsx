import React from 'react';
import {css} from '@emotion/core';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'app/actionCreators/modal';
import Button from 'app/components/button';
import TextOverflow from 'app/components/textOverflow';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {Image} from 'app/types/debugImage';
import theme from 'app/utils/theme';

import NotAvailable from './notAvailable';
import Table from './table';
import UploadedDebugFilesTable from './uploadedDebugFilesTable';

const UPLOADED_TO_SENTRY = 'sentry:project';

type Props = ModalRenderProps & {
  projectId: Project['id'];
  organization: Organization;
  image: Image;
  imageStartAddress: React.ReactElement | null;
  imageEndAddress: React.ReactElement | null;
  title?: string;
};

function DebugFileDetails({
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
}: Props) {
  const {debug_id, arch: architecture, code_file, code_id, candidates = []} = image;

  const uploadedCandidates = candidates.filter(
    candidate => candidate.source === UPLOADED_TO_SENTRY
  );

  const externalCandidates = candidates.filter(
    candidate => candidate.source !== UPLOADED_TO_SENTRY
  );

  return (
    <React.Fragment>
      <Header closeButton>{title ?? t('Unknown name')}</Header>
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
          <UploadedDebugFilesTable
            candidates={uploadedCandidates}
            organization={organization}
            projectId={projectId}
            debugId={debug_id}
          />
          <ExternalDebugFilesTable
            title={t('External Debug Files')}
            description="this is a description"
            candidates={externalCandidates}
            emptyMessage={t('No external debug files were found')}
          />
        </Content>
      </Body>
      <Footer>
        <Button onClick={closeModal}>{t('Close')}</Button>
      </Footer>
    </React.Fragment>
  );
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

const ExternalDebugFilesTable = styled(Table)``;

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
