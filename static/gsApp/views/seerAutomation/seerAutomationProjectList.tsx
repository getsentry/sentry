import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import Placeholder from 'sentry/components/placeholder';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {useDetailedProject} from 'sentry/utils/useDetailedProject';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {formatSeerValue} from 'sentry/views/settings/projectSeer';

const PROJECTS_PER_PAGE = 20;

function ProjectSeerSetting({project, orgSlug}: {orgSlug: string; project: Project}) {
  const detailedProject = useDetailedProject({
    orgSlug,
    projectSlug: project.slug,
  });

  if (detailedProject.isPending) {
    return (
      <div>
        <Placeholder height="12px" width="50px" />
      </div>
    );
  }

  if (detailedProject.isError) {
    return <div>Error</div>;
  }

  return (
    <SeerValue>{formatSeerValue(detailedProject.data.autofixAutomationTuning)}</SeerValue>
  );
}

export function SeerAutomationProjectList() {
  const organization = useOrganization();
  const {projects, fetching, fetchError} = useProjects();
  const [page, setPage] = useState(1);

  if (fetching) {
    return <LoadingIndicator />;
  }

  if (fetchError) {
    return <LoadingError />;
  }

  const totalProjects = projects.length;
  const pageStart = (page - 1) * PROJECTS_PER_PAGE;
  const pageEnd = page * PROJECTS_PER_PAGE;
  const paginatedProjects = projects.slice(pageStart, pageEnd);

  const previousDisabled = page <= 1;
  const nextDisabled = pageEnd >= totalProjects;

  const goToPrevPage = () => {
    setPage(p => p - 1);
  };

  const goToNextPage = () => {
    setPage(p => p + 1);
  };

  return (
    <Fragment>
      <Panel>
        <PanelHeader>
          <div>{t('Current Project Settings')}</div>
        </PanelHeader>
        <PanelBody>
          {paginatedProjects.map(project => (
            <PanelItem key={project.id}>
              <Flex justify="space-between" gap={space(2)} flex={1}>
                <Flex gap={space(1)} align="center">
                  <ProjectAvatar project={project} title={project.slug} />
                  <Link
                    to={`/settings/${organization.slug}/projects/${project.slug}/seer/`}
                  >
                    {project.slug}
                  </Link>
                </Flex>
                <ProjectSeerSetting project={project} orgSlug={organization.slug} />
              </Flex>
            </PanelItem>
          ))}
        </PanelBody>
      </Panel>
      {totalProjects > PROJECTS_PER_PAGE && (
        <Flex justify="flex-end">
          <ButtonBar merged>
            <Button
              icon={<IconChevron direction="left" />}
              aria-label={t('Previous')}
              size="sm"
              disabled={previousDisabled}
              onClick={goToPrevPage}
            />
            <Button
              icon={<IconChevron direction="right" />}
              aria-label={t('Next')}
              size="sm"
              disabled={nextDisabled}
              onClick={goToNextPage}
            />
          </ButtonBar>
        </Flex>
      )}
    </Fragment>
  );
}

const SeerValue = styled('div')`
  color: ${p => p.theme.subText};
`;
