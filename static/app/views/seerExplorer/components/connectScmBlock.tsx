import {Fragment, useState} from 'react';
import {IconLock} from '@sentry/icons/lock';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {ScmIntegrationConnect} from 'sentry/components/onboarding/scm/scmIntegrationConnect';
import {useScmProviders} from 'sentry/components/onboarding/scm/useScmProviders';
import {
  PipelineModal,
  type OpenPipelineModalOptions,
} from 'sentry/components/pipeline/modal';
import {t} from 'sentry/locale';
import type {Integration, Repository} from 'sentry/types/integrations';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {ScmConnectInfo} from 'sentry/views/onboarding/scmConnect';
import type {ConnectScmData} from 'sentry/views/seerExplorer/types';

export type ConnectScmResponse = {
  integration_id: string;
  integration_name: string;
  /** Slugs of the projects the repository was linked to. */
  linked_projects: string[];
  provider: string;
  provider_name: string;
  repo_name: string | null;
  status: 'connected';
};

interface ConnectScmModalProps extends ModalRenderProps {
  data: ConnectScmData;
  onComplete: (response: ConnectScmResponse) => void;
}

/**
 * The connect step of onboarding, as a modal: provider pills, then the repo picker once a
 * provider is installed. Continue links the repo to the projects Seer named and hands it back to
 * the paused Seer run.
 *
 * A provider's install runs inside this modal rather than in a modal of its own, so the picker
 * keeps its state and doesn't redraw when the install finishes or the user goes back.
 */
export function ConnectScmModal(props: ConnectScmModalProps) {
  const {Header, Body, Footer, closeModal, data, onComplete} = props;
  const [selectedIntegration, setSelectedIntegration] = useState<Integration>();
  const [selectedRepository, setSelectedRepository] = useState<Repository>();
  const [isLinking, setIsLinking] = useState(false);
  const organization = useOrganization();
  const {activeIntegrations} = useScmProviders();
  const {projects: allProjects} = useProjects();
  const projects = (data.project_slugs ?? [])
    .map(slug => allProjects.find(project => project.slug === slug))
    .filter(project => project !== undefined);
  const effectiveIntegration = selectedIntegration ?? activeIntegrations[0];
  const [installPipeline, setInstallPipeline] =
    useState<OpenPipelineModalOptions<'integration'>>();

  // Back, or the end of the install. Reported as a close so an unfinished install counts as
  // cancelled, as it would when its own modal closes.
  function closeInstallPipeline() {
    installPipeline?.onClose?.();
    setInstallPipeline(undefined);
  }

  async function handleContinue() {
    if (!effectiveIntegration || !selectedRepository?.id) {
      return;
    }
    setIsLinking(true);
    const results = await Promise.allSettled(
      projects.map(project =>
        fetchMutation({
          url: getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/repo/', {
            path: {
              organizationIdOrSlug: organization.slug,
              projectIdOrSlug: project.slug,
            },
          }),
          method: 'POST',
          data: {repositoryId: selectedRepository.id},
        })
      )
    );
    const linkedProjects = projects
      .filter((_, index) => results[index]!.status === 'fulfilled')
      .map(project => project.slug);
    if (linkedProjects.length < projects.length) {
      // Seer can still read the repo, so carry on and leave the link for settings.
      addErrorMessage(t('Failed to link the repository to some projects'));
    }
    setIsLinking(false);
    onComplete({
      status: 'connected',
      integration_id: effectiveIntegration.id,
      integration_name: effectiveIntegration.name,
      linked_projects: linkedProjects,
      provider: effectiveIntegration.provider.key,
      provider_name: effectiveIntegration.provider.name,
      repo_name: selectedRepository.name,
    });
    closeModal();
  }

  return (
    <Fragment>
      {installPipeline ? (
        <PipelineModal
          {...props}
          type={installPipeline.type}
          provider={installPipeline.provider}
          initialData={installPipeline.initialData}
          title={installPipeline.title}
          description={installPipeline.description}
          onComplete={installPipeline.onComplete}
          onError={installPipeline.onError}
          onBack={closeInstallPipeline}
          closeModal={closeInstallPipeline}
        />
      ) : null}
      {/* Hidden rather than unmounted during an install, so the picker keeps its state. */}
      <Container display={installPipeline ? 'none' : 'contents'}>
        <Header closeButton>
          <Text size="lg">{t('Connect your code')}</Text>
        </Header>
        <Body>
          <Stack gap="2xl">
            <Text>{data.reason}</Text>
            {projects.length > 0 ? (
              <Stack gap="sm">
                <Text bold>{t('Link a repository to')}</Text>
                <Flex gap="lg" wrap="wrap">
                  {projects.map(project => (
                    <ProjectBadge key={project.id} project={project} disableLink />
                  ))}
                </Flex>
                <Text variant="muted" size="sm">
                  {t(
                    'Seer reads this code in later conversations about these projects too.'
                  )}
                </Text>
              </Stack>
            ) : null}
            <ScmIntegrationConnect
              analyticsFlow="project-creation"
              onClearDerivedState={() => {}}
              onIntegrationChange={setSelectedIntegration}
              onRepositoryChange={setSelectedRepository}
              selectedIntegration={selectedIntegration}
              selectedRepository={selectedRepository}
              allowIntegrationSwitching={activeIntegrations.length > 1}
              maxWidth="100%"
              openInstallPipeline={setInstallPipeline}
            />
            <ScmConnectInfo />
          </Stack>
        </Body>
        <Footer>
          <Flex align="center" justify="between" gap="md" width="100%">
            <Flex gap="sm" align="center">
              <IconLock size="sm" variant="secondary" locked aria-hidden />
              <Text variant="secondary" size="sm">
                {t('Revoke access any time in settings')}
              </Text>
            </Flex>
            <Button
              variant="primary"
              onClick={handleContinue}
              disabled={!effectiveIntegration || !selectedRepository?.id}
              // A picked repo has no id until the picker finds or creates Sentry's record of it.
              busy={
                isLinking || (selectedRepository !== undefined && !selectedRepository.id)
              }
            >
              {projects.length > 0 ? t('Link and continue') : t('Continue')}
            </Button>
          </Flex>
        </Footer>
      </Container>
    </Fragment>
  );
}

function openConnectScmModal(
  data: ConnectScmData,
  onComplete: (response: ConnectScmResponse) => void
) {
  openModal(
    modalProps => <ConnectScmModal {...modalProps} data={data} onComplete={onComplete} />,
    // Not on a backdrop click: that would lose a half-finished provider install.
    {closeEvents: 'escape-key'}
  );
}

interface ConnectScmBlockProps {
  data: ConnectScmData;
  onComplete: (response: ConnectScmResponse) => void;
}

/**
 * Pinned in the chat while the run waits for source control; its button opens the connect modal.
 */
export function ConnectScmBlock({data, onComplete}: ConnectScmBlockProps) {
  const openConnectModal = () => openConnectScmModal(data, onComplete);

  return (
    <Container padding="xl">
      <Container padding="xl" border="primary" radius="md">
        <Flex align="center" justify="between" gap="lg">
          <Stack gap="xs">
            <Text bold>{t('Seer needs access to your code to continue')}</Text>
            <Text variant="secondary" size="sm">
              {data.reason}
            </Text>
          </Stack>
          <Button size="sm" variant="primary" onClick={openConnectModal}>
            {t('Connect your code')}
          </Button>
        </Flex>
      </Container>
    </Container>
  );
}
