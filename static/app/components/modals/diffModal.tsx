import {css} from '@emotion/react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import IssueDiff from 'sentry/components/issueDiff';
import {useDetailedProject} from 'sentry/utils/useDetailedProject';
import useOrganization from 'sentry/utils/useOrganization';

type Props = ModalRenderProps & React.ComponentProps<typeof IssueDiff>;

function DiffModal({className, Body, CloseButton, ...props}: Props) {
  const organization = useOrganization();
  const {project} = props;
  const {data: projectData} = useDetailedProject({
    orgSlug: organization.slug,
    projectSlug: project.slug,
  });
  // similarity-embeddings feature is only available on project details
  const similarityEmbeddingsProjectFeature = projectData?.features.includes(
    'similarity-embeddings'
  );

  return (
    <Body>
      <CloseButton />
      <IssueDiff
        className={className}
        organization={organization}
        hasSimilarityEmbeddingsProjectFeature={similarityEmbeddingsProjectFeature}
        {...props}
      />
    </Body>
  );
}

const modalCss = css`
  position: absolute;
  left: 20px;
  right: 20px;
  top: 20px;
  bottom: 20px;
  display: flex;
  padding: 0;
  width: auto;

  [role='document'] {
    height: 100%;
    display: flex;
    flex: 1;
  }

  section {
    display: flex;
    width: 100%;
  }
`;

export {modalCss};

export default DiffModal;
