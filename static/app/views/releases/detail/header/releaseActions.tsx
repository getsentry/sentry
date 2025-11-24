import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Container} from '@sentry/scraps/layout/container';

import {archiveRelease, restoreRelease} from 'sentry/actionCreators/release';
import {Client} from 'sentry/api';
import {openConfirmModal} from 'sentry/components/confirm';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import TextOverflow from 'sentry/components/textOverflow';
import {IconEllipsis, IconMegaphone, IconNext, IconPrevious} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Release, ReleaseMeta} from 'sentry/types/release';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {isReleaseArchived} from 'sentry/views/releases/utils';
import {makeReleasesPathname} from 'sentry/views/releases/utils/pathnames';

type Props = {
  projectSlug: string;
  refetchData: () => void;
  release: Release;
  releaseMeta: ReleaseMeta;
};

function ReleaseActions({projectSlug, release, releaseMeta, refetchData}: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();
  const openFeedbackForm = useFeedbackForm();

  async function handleArchive() {
    try {
      await archiveRelease(new Client(), {
        orgSlug: organization.slug,
        projectSlug,
        releaseVersion: release.version,
      });
      navigate(
        makeReleasesPathname({
          organization,
          path: '/',
        })
      );
    } catch {
      // do nothing, action creator is already displaying error message
    }
  }

  async function handleRestore() {
    try {
      await restoreRelease(new Client(), {
        orgSlug: organization.slug,
        projectSlug,
        releaseVersion: release.version,
      });
      refetchData();
    } catch {
      // do nothing, action creator is already displaying error message
    }
  }

  function getProjectList() {
    const maxVisibleProjects = 5;
    const visibleProjects = releaseMeta.projects.slice(0, maxVisibleProjects);
    const numberOfCollapsedProjects =
      releaseMeta.projects.length - visibleProjects.length;

    return (
      <Fragment>
        {visibleProjects.map(project => (
          <ProjectBadge key={project.slug} project={project} avatarSize={18} />
        ))}
        {numberOfCollapsedProjects > 0 && (
          <span>
            <Tooltip
              title={release.projects
                .slice(maxVisibleProjects)
                .map(p => p.slug)
                .join(', ')}
            >
              + {tn('%s other project', '%s other projects', numberOfCollapsedProjects)}
            </Tooltip>
          </span>
        )}
      </Fragment>
    );
  }

  function getModalHeader(title: React.ReactNode) {
    return (
      <ModalHeaderContainer>
        <TextOverflow>{title}</TextOverflow>
      </ModalHeaderContainer>
    );
  }

  function getModalMessage(message: React.ReactNode) {
    return (
      <Fragment>
        {message}

        <ProjectsWrapper>{getProjectList()}</ProjectsWrapper>

        {t('Are you sure you want to do this?')}
      </Fragment>
    );
  }

  function replaceReleaseUrl(toRelease: string | null) {
    return toRelease
      ? {
          pathname: location.pathname
            .replace(encodeURIComponent(release.version), encodeURIComponent(toRelease))
            .replace(release.version, encodeURIComponent(toRelease)),
          query: {...location.query, activeRepo: undefined},
        }
      : '';
  }

  function handleNavigationClick(direction: string) {
    trackAnalytics(`release_detail.pagination`, {
      organization,
      direction,
    });
  }

  const menuItems = [
    isReleaseArchived(release)
      ? {
          key: 'restore',
          label: t('Restore'),
          onAction: () =>
            openConfirmModal({
              onConfirm: handleRestore,
              header: getModalHeader(
                tct('Restore Release [release]', {
                  release: formatVersion(release.version),
                })
              ),
              message: getModalMessage(
                tn(
                  'You are restoring this release for the following project:',
                  'By restoring this release, you are also restoring it for the following projects:',
                  releaseMeta.projects.length
                )
              ),
              cancelText: t('Nevermind'),
              confirmText: t('Restore'),
            }),
        }
      : {
          key: 'archive',
          label: t('Archive'),
          onAction: () =>
            openConfirmModal({
              onConfirm: handleArchive,
              header: getModalHeader(
                tct('Archive Release [release]', {
                  release: formatVersion(release.version),
                })
              ),
              message: getModalMessage(
                tn(
                  'You are archiving this release for the following project:',
                  'By archiving this release, you are also archiving it for the following projects:',
                  releaseMeta.projects.length
                )
              ),
              cancelText: t('Nevermind'),
              confirmText: t('Archive'),
            }),
        },
  ];

  const hasPrevious = !!release.currentProjectMeta.prevReleaseVersion;
  const hasNext = !!release.currentProjectMeta.nextReleaseVersion;

  return (
    <ButtonBar>
      {openFeedbackForm ? (
        <Container display={{'2xs': 'none', xs: 'block'}}>
          <Button
            size="sm"
            icon={<IconMegaphone />}
            onClick={() =>
              openFeedbackForm({
                messagePlaceholder: t('How can we improve the Releases experience?'),
                tags: {
                  ['feedback.source']: 'release-detail',
                },
              })
            }
          >
            {t('Give Feedback')}
          </Button>
        </Container>
      ) : null}
      <ButtonBar merged gap="0">
        <LinkButton
          size="sm"
          to={replaceReleaseUrl(release.currentProjectMeta.firstReleaseVersion)}
          disabled={!hasPrevious}
          aria-label={t('Oldest')}
          icon={<IconPrevious />}
          onClick={() => handleNavigationClick('oldest')}
        />
        <LinkButton
          size="sm"
          to={replaceReleaseUrl(release.currentProjectMeta.prevReleaseVersion)}
          disabled={!hasPrevious}
          onClick={() => handleNavigationClick('older')}
        >
          {t('Older')}
        </LinkButton>
        <LinkButton
          size="sm"
          to={replaceReleaseUrl(release.currentProjectMeta.nextReleaseVersion)}
          disabled={!hasNext}
          onClick={() => handleNavigationClick('newer')}
        >
          {t('Newer')}
        </LinkButton>
        <LinkButton
          size="sm"
          to={replaceReleaseUrl(release.currentProjectMeta.lastReleaseVersion)}
          disabled={!hasNext}
          aria-label={t('Newest')}
          icon={<IconNext />}
          onClick={() => handleNavigationClick('newest')}
        />
      </ButtonBar>
      <DropdownMenu
        size="sm"
        items={menuItems}
        triggerProps={{
          showChevron: false,
          icon: <IconEllipsis />,
          'aria-label': t('Actions'),
        }}
        position="bottom-end"
      />
    </ButtonBar>
  );
}

const ProjectsWrapper = styled('div')`
  margin: ${space(2)} 0 ${space(2)} ${space(2)};
  display: grid;
  gap: ${space(0.5)};
  img {
    border: none !important;
    box-shadow: none !important;
  }
`;

const ModalHeaderContainer = styled('h4')`
  max-width: 100%;
`;

export default ReleaseActions;
