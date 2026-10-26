import {Fragment, type ReactNode} from 'react';
import {IconArrow} from '@sentry/icons/arrow';
import {IconLock} from '@sentry/icons/lock';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Select, components} from '@sentry/scraps/select';
import {Heading, Text} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';
import {RequestError} from 'sentry/utils/requestError/requestError';

export function getApiErrorMessage(error: unknown): string {
  if (!(error instanceof RequestError)) {
    return t('Failed to connect repository');
  }

  const json = error.responseJSON;

  if (typeof (json as unknown) === 'string') {
    return json as unknown as string;
  }

  const {detail} = json ?? {};
  if (typeof detail === 'string' && detail) {
    return detail;
  }
  if (detail && typeof detail === 'object' && typeof detail.message === 'string') {
    return detail.message;
  }

  const nonFieldErrors = json?.nonFieldErrors ?? json?.non_field_errors;
  if (Array.isArray(nonFieldErrors) && typeof nonFieldErrors[0] === 'string') {
    return nonFieldErrors[0];
  }

  for (const value of Object.values(json ?? {})) {
    if (Array.isArray(value) && typeof value[0] === 'string') {
      return value[0];
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

export function LockedProjectField({project}: {project: Project}) {
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

// Presentational shell shared by all modes — owns no queries or mutations.
// Callers provide both field slots so the frame stays layout-only and can
// support any locked/selectable combination without internal branching.
export interface ConnectionModalFrameProps {
  Body: ModalRenderProps['Body'];
  Footer: ModalRenderProps['Footer'];
  Header: ModalRenderProps['Header'];
  alerts: ReactNode;
  canSave: boolean;
  closeModal: () => void;
  isSaving: boolean;
  // Left column of the connection grid (label + field).
  leftField: ReactNode;
  leftLabel: string;
  onSave: () => void;
  pathsSection: ReactNode;
  // Right column of the connection grid (label + field).
  rightField: ReactNode;
  rightLabel: string;
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
  leftLabel,
  leftField,
  rightLabel,
  rightField,
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
              {leftLabel}
            </Text>
            <Container />
            <Text size="sm" bold>
              {rightLabel}
            </Text>
            <Container minWidth={0}>{leftField}</Container>
            <IconArrow direction="right" />
            <Container minWidth={0}>{rightField}</Container>
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
