import {css} from '@emotion/react';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {openModal} from 'sentry/actionCreators/modal';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import {InstallDetailsContent} from 'sentry/views/preprod/components/installDetailsContent';

interface InstallModalProps {
  artifactId: string;
  closeModal: () => void;
  projectSlug: string;
}

function InstallModal({artifactId, closeModal, projectSlug}: InstallModalProps) {
  return (
    <Flex direction="column">
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
        <InstallDetailsContent
          artifactId={artifactId}
          size="sm"
          projectSlug={projectSlug}
        />
      </Container>
    </Flex>
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
