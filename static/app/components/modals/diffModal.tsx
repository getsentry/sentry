import {useState} from 'react';
import {css} from '@emotion/react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import IssueDiff from 'sentry/components/issueDiff';
import useOrganization from 'sentry/utils/useOrganization';
import {fetchProjectDetails} from 'sentry/views/issueDetails/groupSimilarIssues/similarStackTrace';

type Props = ModalRenderProps & React.ComponentProps<typeof IssueDiff>;

function DiffModal({className, Body, CloseButton, ...props}: Props) {
  const organization = useOrganization();
  const api = new Client();
  const {project} = props;
  const [similarityEmbeddingsProjectFeature, setSimilarityEmbeddingsProjectFeature] =
    useState<boolean>(false);
  fetchProjectDetails(api, organization?.slug, project.slug).then(response => {
    setSimilarityEmbeddingsProjectFeature(
      response.features.includes('similarity-embeddings')
    );
  });
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
