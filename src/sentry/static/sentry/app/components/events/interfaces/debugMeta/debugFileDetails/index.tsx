import React from 'react';
import {css} from '@emotion/core';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Button from 'app/components/button';
import TextOverflow from 'app/components/textOverflow';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {Image} from 'app/types/debugImage';
import theme from 'app/utils/theme';
import withApi from 'app/utils/withApi';

import NotAvailable from './notAvailable';
import Panel from './panel';

const UPLOADED_TO_SENTRY = 'sentry:project';

type Props = ModalRenderProps & {
  api: Client;
  projectId: Project['id'];
  organization: Organization;
  image: Image;
  title?: string;
};

function DebugFileDetails({
  Header,
  Body,
  Footer,
  closeModal,
  title,
  image,
  organization,
  api,
  projectId,
}: Props) {
  const {debug_id, image_addr, arch: architecture, code_file, candidates = []} = image;

  const uploadedCandidates = candidates.filter(
    candidate => candidate.source === UPLOADED_TO_SENTRY
  );

  const externalCandidates = candidates.filter(
    candidate => candidate.source !== UPLOADED_TO_SENTRY
  );

  // TODO(PRISCILA): Should we perform a new request to fetch the debug files?
  // because at the moment the payload of the event is not being updated
  // async function handleDelete(debugId: string) {
  //   api.request(
  //     `/projects/${organization.slug}/${projectId}/files/dsyms/?id=${debugId}`,
  //     {
  //       method: 'DELETE',
  //       complete: () => {
  //
  //       },
  //     }
  //   );
  // }

  return (
    <React.Fragment>
      <Header closeButton>{title ?? t('Unknown name')}</Header>
      <Body>
        <Content>
          <GeneralInfo>
            <Label>{t('Address Range')}</Label>
            <Value>{image_addr}</Value>

            <Label coloredBg>{t('Architecture')}</Label>
            <Value coloredBg>{architecture ?? <NotAvailable />}</Value>

            <Label>{t('Debug ID')}</Label>
            <Value>{debug_id}</Value>

            <Label coloredBg>{t('Code File')}</Label>
            <Value coloredBg>{code_file}</Value>
          </GeneralInfo>
          <Panel
            title={t('Uploaded Debug Files')}
            description="this is a description"
            candidates={uploadedCandidates}
            organization={organization}
            projectId={projectId}
            api={api}
            emptyMessage={t("You haven't uploaded any debug file")}
            onDelete={() => {}} // TODO(PRISCILA): finalize the delete button
          />
          <Panel
            title={t('External Debug Files')}
            description="this is a description"
            candidates={externalCandidates}
            organization={organization}
            projectId={projectId}
            api={api}
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

export default withApi(DebugFileDetails);

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
