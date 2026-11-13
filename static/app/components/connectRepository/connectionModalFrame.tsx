import {Fragment, type ReactNode} from 'react';
import {css, type Theme} from '@emotion/react';
import {IconLock} from '@sentry/icons/lock';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import type {ModalRenderProps} from '@sentry/scraps/modal';
import {Select} from '@sentry/scraps/select';
import {Heading, Text} from '@sentry/scraps/text';

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
      dropdownIndicator={<IconLock locked size="xs" />}
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

/**
 * Caps the visible modal surface at 800px. The dialog wrapper pads the
 * surface horizontally, so widen the wrapper by that padding and cap the
 * surface itself.
 */
export const connectRepositoryModalCss = (theme: Theme) => css`
  width: calc(800px + 2 * ${theme.space.xl});
  max-width: 100%;

  [role='document'] {
    max-width: 800px;
    margin: 0 auto;
  }
`;

/**
 * The project or repository named in the modal title, with its avatar or
 * SCM logo. The title row centers it against the surrounding text.
 */
function ModalTitleSubject({icon, name}: {icon: ReactNode; name: string}) {
  return (
    <Flex as="span" align="center" gap="sm" minWidth={0}>
      <Flex as="span" flexShrink={0}>
        {icon}
      </Flex>
      {name}
    </Flex>
  );
}

export function ProjectTitleSubject({project}: {project: Project}) {
  return (
    <ModalTitleSubject
      icon={<ProjectAvatar project={project} size={18} />}
      name={project.slug}
    />
  );
}

export function RepoTitleSubject({
  repoName,
  providerKey,
}: {
  providerKey: string | null | undefined;
  repoName: string;
}) {
  return (
    <ModalTitleSubject
      icon={getIntegrationIcon(providerKey ?? undefined)}
      name={repoName}
    />
  );
}

// Presentational shell shared by all modes — owns no queries or mutations.
// The locked side of the connection is named in the title, so the body only
// renders the one field the user can still change (or a locked reference to
// it in edit mode).
export interface ConnectionModalFrameProps {
  Body: ModalRenderProps['Body'];
  Footer: ModalRenderProps['Footer'];
  Header: ModalRenderProps['Header'];
  alerts: ReactNode;
  canSave: boolean;
  closeModal: () => void;
  field: ReactNode;
  fieldLabel: string;
  isSaving: boolean;
  onSave: () => void;
  pathsSection: ReactNode;
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
  fieldLabel,
  field,
  pathsSection,
  canSave,
  isSaving,
  onSave,
}: ConnectionModalFrameProps) {
  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h4">
          {/* One centered row so the icon lines up with the title text. */}
          <Flex as="span" align="center" gap="md" wrap="wrap">
            {title}
          </Flex>
        </Heading>
      </Header>
      <Body>
        <Stack gap="2xl">
          {intro}
          {alerts}
          <Stack gap="md">
            <Text bold>{fieldLabel}</Text>
            <Container minWidth={0}>{field}</Container>
          </Stack>
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
