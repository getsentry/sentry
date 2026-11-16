import {css} from '@emotion/react';
import {IconClose} from '@sentry/icons/close';

import {Button} from '@sentry/scraps/button';
import {Container, Stack, Grid} from '@sentry/scraps/layout';
import {openModal} from '@sentry/scraps/modal';
import {Heading} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

import {InstallDetailsContent} from './installDetailsContent';

interface InstallModalProps {
  artifactId: string;
  closeModal: () => void;
  projectSlug: string;
}

function InstallModal({artifactId, closeModal, projectSlug}: InstallModalProps) {
  return (
    <Stack>
      <Grid display="grid" columns="1fr auto 1fr" align="center">
        <Container />
        <Heading as="h2" style={{textAlign: 'center'}}>
          {t('Download Build')}
        </Heading>
        <Container justifySelf="end">
          <Button
            onClick={closeModal}
            variant="transparent"
            icon={<IconClose />}
            size="sm"
            aria-label={t('Close')}
          />
        </Container>
      </Grid>
      <Container padding="xl">
        <InstallDetailsContent artifactId={artifactId} projectSlug={projectSlug} />
      </Container>
    </Stack>
  );
}

export function openInstallModal(artifactId: string, projectSlug: string) {
  openModal(
    ({closeModal}) => (
      <InstallModal
        artifactId={artifactId}
        closeModal={closeModal}
        projectSlug={projectSlug}
      />
    ),
    {
      modalCss: css`
        max-width: 500px;
      `,
    }
  );
}
