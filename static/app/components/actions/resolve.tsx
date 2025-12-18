import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {openConfirmModal} from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Tooltip} from 'sentry/components/core/tooltip';
import CustomCommitsResolutionModal from 'sentry/components/customCommitsResolutionModal';
import CustomResolutionModal from 'sentry/components/customResolutionModal';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconChevron, IconReleases} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {GroupStatusResolution, ResolvedStatusDetails} from 'sentry/types/group';
import {GroupStatus, GroupSubstatus} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {withChonk} from 'sentry/utils/theme/withChonk';
import useOrganization from 'sentry/utils/useOrganization';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {isSemverRelease} from 'sentry/utils/versions/isSemverRelease';
import useProjectLatestSemverRelease from 'sentry/views/issueDetails/useProjectLatestSemverRelease';

function SetupReleasesPrompt() {
  return (
    <SetupReleases>
      <IconReleases size="xl" />
      <div>
        <SetupReleasesHeader>
          {t('Resolving is better with Releases')}
        </SetupReleasesHeader>
        {t(
          'Set up Releases so Sentry can bother you when this problem comes back in a future release.'
        )}
      </div>
      <LinkButton
        priority="primary"
        external
        size="xs"
        href="https://docs.sentry.io/product/releases/setup/"
        analyticsEventName="Issue Actions: Resolve Release Setup Prompt Clicked"
        analyticsEventKey="issue_actions.resolve_release_setup_prompt_clicked"
      >
        {t('Set up Releases Now')}
      </LinkButton>
    </SetupReleases>
  );
}

interface ResolveActionsProps {
  hasRelease: boolean;
  hasSemverReleaseFeature: boolean;
  onUpdate: (data: GroupStatusResolution) => void;
  confirmLabel?: string;
  confirmMessage?: React.ReactNode;
  disableDropdown?: boolean;
  disableResolveInRelease?: boolean;
  disabled?: boolean;
  isAutoResolved?: boolean;
  isResolved?: boolean;
  latestRelease?: Project['latestRelease'];
  multipleProjectsSelected?: boolean;
  priority?: 'primary';
  projectFetchError?: boolean;
  projectSlug?: string;
  shouldConfirm?: boolean;
  size?: 'xs' | 'sm';
}

function ResolveActions({
  size = 'xs',
  isResolved = false,
  isAutoResolved = false,
  confirmLabel = t('Resolve'),
  projectSlug,
  hasRelease,
  latestRelease,
  confirmMessage,
  shouldConfirm,
  disabled,
  disableDropdown,
  disableResolveInRelease,
  priority,
  projectFetchError,
  multipleProjectsSelected,
  hasSemverReleaseFeature,
  onUpdate,
}: ResolveActionsProps) {
  const organization = useOrganization();

  // resolve in semver release is eligible if the flag is enabled,
  // only 1 project is selected,
  // and resolve in release is not disabled
  const latestSemverRelease = useProjectLatestSemverRelease({
    enabled:
      Boolean(hasSemverReleaseFeature) &&
      !multipleProjectsSelected &&
      !disableResolveInRelease,
  });

  function handleCommitResolution(statusDetails: ResolvedStatusDetails) {
    onUpdate({
      status: GroupStatus.RESOLVED,
      statusDetails,
      substatus: null,
    });
  }

  function handleAnotherExistingReleaseResolution(statusDetails: ResolvedStatusDetails) {
    onUpdate({
      status: GroupStatus.RESOLVED,
      statusDetails,
      substatus: null,
    });
    trackAnalytics('resolve_issue', {
      organization,
      release: 'anotherExisting',
    });
  }

  function handleCurrentReleaseResolution({
    isLatestSemverRelease,
  }: {
    isLatestSemverRelease: boolean;
  }) {
    if (hasRelease) {
      onUpdate({
        status: GroupStatus.RESOLVED,
        statusDetails: {
          inRelease: isLatestSemverRelease
            ? latestSemverRelease?.version
            : latestRelease
              ? latestRelease.version
              : 'latest',
        },
        substatus: null,
      });
    }

    trackAnalytics('resolve_issue', {
      organization,
      release: isLatestSemverRelease ? 'current-semver' : 'current',
    });
  }

  function handleNextReleaseResolution() {
    if (hasRelease) {
      onUpdate({
        status: GroupStatus.RESOLVED,
        statusDetails: {
          inNextRelease: true,
        },
        substatus: null,
      });
    }

    trackAnalytics('resolve_issue', {
      organization,
      release: 'next',
    });
  }

  function renderResolved() {
    return (
      <Tooltip
        title={
          isAutoResolved
            ? t(
                'This event is resolved due to the Auto Resolve configuration for this project'
              )
            : t('Unresolve')
        }
      >
        <Button
          priority="primary"
          size="xs"
          aria-label={t('Unresolve')}
          disabled={isAutoResolved}
          onClick={() =>
            onUpdate({
              status: GroupStatus.UNRESOLVED,
              statusDetails: {},
              substatus: GroupSubstatus.ONGOING,
            })
          }
        />
      </Tooltip>
    );
  }

  function renderDropdownMenu() {
    if (isResolved) {
      return renderResolved();
    }

    const shouldDisplayCta = !hasRelease && !multipleProjectsSelected;
    const actionTitle = shouldDisplayCta
      ? t('Set up release tracking in order to use this feature.')
      : '';

    const onActionOrConfirm = (onAction: () => void) => {
      openConfirmModal({
        bypass: !shouldConfirm,
        onConfirm: onAction,
        message: confirmMessage,
        confirmText: confirmLabel,
      });
    };

    const isSemver = latestRelease ? isSemverRelease(latestRelease.version) : false;
    const items: MenuItemProps[] = [
      {
        key: 'next-release',
        label: t('The next release'),
        details: actionTitle ? actionTitle : t('The next release after the current one'),
        onAction: () => onActionOrConfirm(handleNextReleaseResolution),
      },
      ...(hasSemverReleaseFeature && latestSemverRelease?.version
        ? [
            {
              key: 'semver-release',
              label: t('The current semver release'),
              details: (
                <CurrentReleaseWrapper>
                  {actionTitle ? (
                    actionTitle
                  ) : (
                    <Fragment>
                      <div>
                        <MaxReleaseWidthWrapper>
                          {formatVersion(latestSemverRelease.version)}
                        </MaxReleaseWidthWrapper>
                      </div>{' '}
                    </Fragment>
                  )}
                </CurrentReleaseWrapper>
              ),
              onAction: () =>
                onActionOrConfirm(() =>
                  handleCurrentReleaseResolution({isLatestSemverRelease: true})
                ),
            },
          ]
        : [
            {
              key: 'current-release',
              label: t('The current release'),
              details: (
                <CurrentReleaseWrapper>
                  {actionTitle ? (
                    actionTitle
                  ) : latestRelease ? (
                    <Fragment>
                      <div>
                        <MaxReleaseWidthWrapper>
                          {formatVersion(latestRelease.version)}
                        </MaxReleaseWidthWrapper>
                      </div>{' '}
                      ({isSemver ? t('semver') : t('non-semver')})
                    </Fragment>
                  ) : null}
                </CurrentReleaseWrapper>
              ),
              onAction: () =>
                onActionOrConfirm(() =>
                  handleCurrentReleaseResolution({isLatestSemverRelease: false})
                ),
            },
          ]),
      {
        key: 'another-release',
        label: t('Another existing release\u2026'),
        onAction: () => openCustomReleaseModal(),
      },
      {
        key: 'a-commit',
        label: t('A commit\u2026'),
        onAction: () => openCustomCommitModal(),
      },
    ];

    const isDisabled = projectSlug ? disableDropdown : disabled;

    return (
      <StyledDropdownMenu
        itemsHidden={shouldDisplayCta}
        items={items}
        trigger={(triggerProps, isOpen) => (
          <DropdownTrigger
            {...triggerProps}
            size={size}
            priority={priority}
            aria-label={t('More resolve options')}
            icon={<IconChevron direction={isOpen ? 'up' : 'down'} size="xs" />}
            disabled={isDisabled}
          />
        )}
        disabledKeys={
          multipleProjectsSelected
            ? ['next-release', 'current-release', 'another-release', 'a-commit']
            : disabled || !hasRelease
              ? [
                  'next-release',

                  ...(hasSemverReleaseFeature && latestSemverRelease?.version
                    ? ['semver-release']
                    : ['current-release']),
                  'another-release',
                ]
              : []
        }
        menuTitle={shouldDisplayCta ? <SetupReleasesPrompt /> : t('Resolved In')}
        isDisabled={isDisabled}
      />
    );
  }

  function openCustomCommitModal() {
    openModal(deps => (
      <CustomCommitsResolutionModal
        {...deps}
        onSelected={(statusDetails: ResolvedStatusDetails) =>
          handleCommitResolution(statusDetails)
        }
        orgSlug={organization.slug}
        projectSlug={projectSlug}
      />
    ));
  }

  function openCustomReleaseModal() {
    openModal(deps => (
      <CustomResolutionModal
        {...deps}
        onSelected={(statusDetails: ResolvedStatusDetails) =>
          handleAnotherExistingReleaseResolution(statusDetails)
        }
        projectSlug={projectSlug}
      />
    ));
  }

  if (isResolved) {
    return renderResolved();
  }

  return (
    <Tooltip disabled={!projectFetchError} title={t('Error fetching project')}>
      <ButtonBar merged gap="0">
        <ResolveButton
          priority={priority}
          size={size}
          title={t("We'll nag you with a notification if another event is seen.")}
          tooltipProps={{delay: 1000, disabled}}
          onClick={() =>
            openConfirmModal({
              bypass: !shouldConfirm,
              onConfirm: () =>
                onUpdate({
                  status: GroupStatus.RESOLVED,
                  statusDetails: {},
                  substatus: null,
                }),
              message: confirmMessage,
              confirmText: confirmLabel,
            })
          }
          disabled={disabled}
        >
          {t('Resolve')}
        </ResolveButton>
        {!disableResolveInRelease && renderDropdownMenu()}
      </ButtonBar>
    </Tooltip>
  );
}

export default ResolveActions;

const ResolveButton = withChonk(
  styled(Button)<{priority?: 'primary'}>`
    box-shadow: none;
    ${p =>
      p.priority === 'primary' &&
      css`
        &::after {
          content: '';
          position: absolute;
          top: -1px;
          bottom: -1px;
          right: -1px;
          border-right: solid 1px currentColor;
          opacity: 0.25;
        }
      `}
  `,
  styled(Button)`
    box-shadow: none;
  `
);

const DropdownTrigger = styled(Button)`
  box-shadow: none;
  border-radius: 0 ${p => p.theme.radius.md} ${p => p.theme.radius.md} 0;
  border-left: none;
`;

/**
 * Used to hide the list items when prompting to set up releases
 */
const StyledDropdownMenu = styled(DropdownMenu)<{itemsHidden: boolean}>`
  ${p =>
    p.itemsHidden &&
    css`
      ul {
        display: none;
      }
    `}
`;

const SetupReleases = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  align-items: center;
  padding: ${space(2)} 0;
  text-align: center;
  color: ${p => p.theme.colors.gray500};
  width: 250px;
  white-space: normal;
  font-weight: ${p => p.theme.fontWeight.normal};
`;

const SetupReleasesHeader = styled('h6')`
  font-size: ${p => p.theme.fontSize.md};
  margin-bottom: ${space(1)};
`;

const CurrentReleaseWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.25)};
`;

const MaxReleaseWidthWrapper = styled('div')`
  ${p => p.theme.overflowEllipsis};
  max-width: 250px;
`;
