import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {LinkButton} from '@sentry/scraps/button/linkButton';
import {Flex} from '@sentry/scraps/layout/flex';
import {Text} from '@sentry/scraps/text';

import {IconClose, IconCommit, IconFocus, IconLock, IconTelescope} from 'sentry/icons';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getFormat, getFormattedDate} from 'sentry/utils/dates';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';
import {getSizeBuildUrl} from 'sentry/views/preprod/utils/buildLinkUtils';

interface BuildButtonProps {
  buildDetails: BuildDetailsApiResponse;
  icon: React.ReactNode;
  label: string;
  projectType: string | null;
  slot: 'head' | 'base';
  onRemove?: () => void;
}

function BuildButton({
  buildDetails,
  icon,
  label,
  onRemove,
  slot,
  projectType,
}: BuildButtonProps) {
  const organization = useOrganization();
  const {projectId} = useParams<{projectId: string}>();
  const sha = buildDetails.vcs_info?.head_sha?.substring(0, 7);
  const branchName = buildDetails.vcs_info?.head_ref;
  const buildId = buildDetails.id;
  const version = buildDetails.app_info?.version;
  const buildNumber = buildDetails.app_info?.build_number;
  const dateBuilt = buildDetails.app_info?.date_built;
  const dateAdded = buildDetails.app_info?.date_added;

  const buildUrl =
    getSizeBuildUrl({
      organizationSlug: organization.slug,
      projectId,
      baseArtifactId: buildId,
    }) ?? '';
  const platform = buildDetails.app_info?.platform ?? null;

  const dateToShow = dateBuilt || dateAdded;
  const formattedDate = getFormattedDate(
    dateToShow,
    getFormat({timeZone: true, year: true}),
    {
      local: true,
    }
  );

  // Build metadata parts for the second line
  const metadataParts = [formattedDate];
  if (version) {
    metadataParts.unshift(`Version ${version}`);
  }
  if (buildNumber) {
    metadataParts.unshift(`Build ${buildNumber}`);
  }

  return (
    <StyledLinkButton
      to={buildUrl}
      onClick={() =>
        trackAnalytics('preprod.builds.compare.go_to_build_details', {
          organization,
          build_id: buildId,
          project_slug: projectId,
          platform,
          project_type: projectType,
          slot,
        })
      }
    >
      <ContentWrapper>
        <ClippedContent>
          <Flex direction="column" gap="xs">
            <Flex align="center" gap="sm">
              {icon}
              <Text size="sm" variant="accent" bold>
                {label}
              </Text>
              {!buildNumber && (
                <Text size="sm" variant="accent" bold>
                  {`#${buildId}`}
                </Text>
              )}
              {sha && (
                <Flex align="center" gap="xs">
                  <IconCommit size="xs" />
                  <Text size="sm" variant="accent" bold monospace>
                    {sha}
                  </Text>
                </Flex>
              )}
              {branchName && (
                <BuildBranch>
                  <Text size="sm" variant="muted">
                    {branchName}
                  </Text>
                </BuildBranch>
              )}
            </Flex>
            <Flex align="center" gap="sm">
              <Text size="sm" variant="muted">
                {metadataParts.join(' • ')}
              </Text>
            </Flex>
          </Flex>
        </ClippedContent>
        {onRemove && (
          <CloseButtonWrapper>
            <Button
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                onRemove();
              }}
              size="zero"
              priority="transparent"
              borderless
              aria-label={t('Clear base build')}
              icon={<IconClose size="xs" variant="accent" />}
            />
          </CloseButtonWrapper>
        )}
      </ContentWrapper>
    </StyledLinkButton>
  );
}

const StyledLinkButton = styled(LinkButton)`
  height: auto;
  min-height: auto;
  align-self: stretch;

  /* Override ButtonLabel overflow to allow close button to extend beyond */
  > span:last-child {
    overflow: visible;
  }
`;

const ContentWrapper = styled('div')`
  position: relative;
  width: 100%;
`;

const ClippedContent = styled('div')`
  overflow: hidden;
`;

const CloseButtonWrapper = styled('div')`
  position: absolute;
  top: 0;
  right: -6px;
  background-color: ${p => p.theme.colors.surface500};
  border-radius: ${p => p.theme.radius.xs};
`;

const ComparisonContainer = styled(Flex)`
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: ${p => p.theme.space.lg};
  width: 100%;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    flex-direction: column;

    > * {
      min-width: 0;
      max-width: 100%;
    }
  }
`;

interface SizeCompareSelectedBuildsProps {
  headBuildDetails: BuildDetailsApiResponse;
  isComparing: boolean;
  onClearBaseBuild: () => void;
  baseBuildDetails?: BuildDetailsApiResponse;
  onTriggerComparison?: () => void;
}

export function SizeCompareSelectedBuilds({
  headBuildDetails,
  baseBuildDetails,
  isComparing,
  onClearBaseBuild,
  onTriggerComparison,
}: SizeCompareSelectedBuildsProps) {
  const organization = useOrganization();
  const {projectId} = useParams<{projectId: string}>();
  const platform = headBuildDetails.app_info?.platform ?? null;
  const project = ProjectsStore.getBySlug(projectId);
  const projectType = project?.platform ?? null;

  return (
    <ComparisonContainer>
      <BuildButton
        buildDetails={headBuildDetails}
        icon={<IconLock size="xs" locked />}
        label={t('Head')}
        slot="head"
        projectType={projectType}
      />

      <Text>{t('vs')}</Text>

      {baseBuildDetails ? (
        <BuildButton
          buildDetails={baseBuildDetails}
          icon={<IconFocus size="xs" variant="accent" />}
          label={t('Base')}
          onRemove={onClearBaseBuild}
          slot="base"
          projectType={projectType}
        />
      ) : (
        <SelectBuild>
          <Text size="sm">{t('Select a build')}</Text>
        </SelectBuild>
      )}

      {onTriggerComparison && (
        <Button
          onClick={() => {
            if (baseBuildDetails) {
              trackAnalytics('preprod.builds.compare.trigger_comparison', {
                organization,
                project_slug: projectId,
                platform,
                build_id: headBuildDetails.id,
                project_type: projectType,
              });
              onTriggerComparison();
            }
          }}
          disabled={!baseBuildDetails || isComparing}
          priority="primary"
          icon={<IconTelescope size="sm" />}
        >
          {isComparing ? t('Comparing...') : t('Compare builds')}
        </Button>
      )}
    </ComparisonContainer>
  );
}

const BuildBranch = styled('span')`
  padding: ${p => p.theme.space['2xs']} ${p => p.theme.space.sm};
  background-color: ${p => p.theme.colors.gray100};
  border-radius: ${p => p.theme.radius.md};
`;

const SelectBuild = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.radius.md};
  border-style: dashed;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
`;
