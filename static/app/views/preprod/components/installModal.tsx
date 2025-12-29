import {css} from '@emotion/react';

import {openModal} from 'sentry/actionCreators/modal';
import {InstallDetailsContent} from 'sentry/views/preprod/components/installDetailsContent';

interface InstallModalProps {
  artifactId: string;
  closeModal: () => void;
  projectId: string;
}

function InstallModal({projectId, artifactId, closeModal}: InstallModalProps) {
  return (
    <InstallDetailsContent
      projectId={projectId}
      artifactId={artifactId}
      onClose={closeModal}
      size="sm"
    />
  );
}

export function openInstallModal(projectId: string, artifactId: string) {
  openModal(
    ({closeModal}) => (
      <InstallModal
        projectId={projectId}
        artifactId={artifactId}
        closeModal={closeModal}
      />
    ),
    {
      modalCss: css`
        max-width: 500px;
      `,
    }
  );
}
