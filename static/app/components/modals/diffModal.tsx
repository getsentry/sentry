import {Fragment} from 'react';
import {css} from '@emotion/react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {IssueDiff} from 'sentry/components/issueDiff';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import useOrganization from 'sentry/utils/useOrganization';

interface Props extends ModalRenderProps, React.ComponentProps<typeof IssueDiff> {
  project: Project;
}

function DiffModal({
  Body,
  Header: Header,
  Footer: _Footer,
  closeModal: _closeModal,
  modalContainerRef: _modalContainerRef,
  project,
  ...props
}: Props) {
  const organization = useOrganization();
  const {data: projectData} = useDetailedProject({
    orgSlug: organization.slug,
    projectSlug: project.slug,
  });
  // similarity-embeddings feature is only available on project details
  const similarityEmbeddingsProjectFeature = projectData?.features.includes(
    'similarity-embeddings'
  );

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Issue Diff')}</h4>
      </Header>
      <Body>
        <IssueDiff
          hasSimilarityEmbeddingsProjectFeature={similarityEmbeddingsProjectFeature}
          {...props}
        />
      </Body>
    </Fragment>
  );
}

const modalCss = css`
  position: absolute;
  padding: 0;
  inset: ${space(3)};
  width: calc(100% - 2 * ${space(3)});

  [role='document'] {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    > section {
      flex: 1;
      min-height: 0;
      overflow: auto;
    }
  }
`;

export {modalCss};

export default DiffModal;
