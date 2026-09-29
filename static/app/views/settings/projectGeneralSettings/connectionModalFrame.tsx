import {Fragment, type ReactNode} from 'react';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Select, components} from '@sentry/scraps/select';
import {Heading, Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {IconLock} from 'sentry/icons';
import {IconArrow} from 'sentry/icons/iconArrow';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {RequestError} from 'sentry/utils/requestError/requestError';

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof RequestError) {
    const detail = error.responseJSON?.detail;
    if (typeof detail === 'string') {
      return detail;
    }
    if (typeof detail?.message === 'string') {
      return detail.message;
    }
  }
  return t('Failed to connect repository');
}

function LockedSelectField({
  ariaLabel,
  value,
  leadingItems,
}: {
  ariaLabel: string;
  leadingItems: ReactNode;
  value: string;
}) {
  return (
    <Select
      disabled
      aria-label={ariaLabel}
      options={[{value, label: value, leadingItems}]}
      value={value}
      components={{
        DropdownIndicator: props => (
          <components.DropdownIndicator {...props}>
            <IconLock locked size="xs" />
          </components.DropdownIndicator>
        ),
      }}
    />
  );
}

function LockedProjectField({project}: {project: Project}) {
  return (
    <LockedSelectField
      ariaLabel={t('Project')}
      value={project.slug}
      leadingItems={<ProjectAvatar project={project} size={16} />}
    />
  );
}

export function LockedRepoField({
  repoName,
  providerKey,
}: {
  providerKey: string | null;
  repoName: string;
}) {
  return (
    <LockedSelectField
      ariaLabel={t('Repository')}
      value={repoName}
      leadingItems={getIntegrationIcon(providerKey ?? undefined, 'sm')}
    />
  );
}

// Presentational shell shared by both modes — owns no queries or mutations.
export interface ConnectionModalFrameProps {
  Body: ModalRenderProps['Body'];
  Footer: ModalRenderProps['Footer'];
  Header: ModalRenderProps['Header'];
  alerts: ReactNode;
  canSave: boolean;
  closeModal: () => void;
  isSaving: boolean;
  onSave: () => void;
  pathsSection: ReactNode;
  project: Project;
  repoField: ReactNode;
  title: ReactNode;
  intro?: ReactNode;
}

export function ConnectionModalFrame({
  Header,
  Body,
  Footer,
  closeModal,
  title,
  intro,
  alerts,
  project,
  repoField,
  pathsSection,
  canSave,
  isSaving,
  onSave,
}: ConnectionModalFrameProps) {
  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h4">{title}</Heading>
      </Header>
      <Body>
        <Stack gap="xl">
          {alerts}
          {intro}
          <Grid columns="1fr auto 1fr" gap="xs md" align="center">
            <Text size="sm" bold>
              {t('Project')}
            </Text>
            <Container />
            <Text size="sm" bold>
              {t('Repository')}
            </Text>
            <Container minWidth={0}>
              <LockedProjectField project={project} />
            </Container>
            <IconArrow direction="right" />
            <Container minWidth={0}>{repoField}</Container>
          </Grid>
          {pathsSection}
        </Stack>
      </Body>
      <Footer>
        <Flex justify="end" gap="md">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button
            variant="primary"
            disabled={!canSave || isSaving}
            busy={isSaving}
            onClick={onSave}
          >
            {t('Save')}
          </Button>
        </Flex>
      </Footer>
    </Fragment>
  );
}
