import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout/flex';
import {Text} from 'sentry/components/core/text';
import {IconClose, IconCommit, IconFocus, IconLock, IconTelescope} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';

interface BuildButtonProps {
  buildDetails: BuildDetailsApiResponse;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  onRemove?: () => void;
}

function BuildButton({buildDetails, icon, label, onClick, onRemove}: BuildButtonProps) {
  const sha = buildDetails.vcs_info?.head_sha?.substring(0, 7);
  const branchName = buildDetails.vcs_info?.head_ref;
  const buildId = buildDetails.id;

  return (
    <Button onClick={onClick}>
      <Flex align="center" gap="sm">
        {icon}
        <Text size="sm" variant="accent" bold>
          {label}
        </Text>
        <Flex align="center" gap="md">
          <Text size="sm" variant="accent" bold>
            {`#${buildId}`}
          </Text>
          {sha && (
            <Flex align="center" gap="xs">
              <IconCommit size="xs" />
              <Text size="sm" variant="accent" bold monospace>
                {sha}
              </Text>
            </Flex>
          )}
        </Flex>
        <BuildBranch>
          <Text size="sm" variant="muted">
            {branchName}
          </Text>
        </BuildBranch>
        {onRemove && (
          <Button
            onClick={e => {
              e.stopPropagation();
              onRemove();
            }}
            size="zero"
            priority="transparent"
            borderless
            aria-label={t('Clear base build')}
            icon={<IconClose size="xs" color="purple400" />}
          />
        )}
      </Flex>
    </Button>
  );
}

interface SizeCompareSelectedBuildsProps {
  headBuildDetails: BuildDetailsApiResponse;
  isComparing: boolean;
  onClearBaseBuild: () => void;
  baseBuildDetails?: BuildDetailsApiResponse;
  onBaseBuildClick?: () => void;
  onHeadBuildClick?: () => void;
  onTriggerComparison?: () => void;
}

export function SizeCompareSelectedBuilds({
  headBuildDetails,
  baseBuildDetails,
  isComparing,
  onBaseBuildClick,
  onClearBaseBuild,
  onHeadBuildClick,
  onTriggerComparison,
}: SizeCompareSelectedBuildsProps) {
  return (
    <Flex align="center" gap="lg" width="100%" justify="center">
      <BuildButton
        buildDetails={headBuildDetails}
        icon={<IconLock size="xs" locked />}
        label={t('Head')}
        onClick={onHeadBuildClick}
      />

      <Text>{t('vs')}</Text>

      <Flex align="center" gap="sm">
        {baseBuildDetails ? (
          <BuildButton
            buildDetails={baseBuildDetails}
            icon={<IconFocus size="xs" color="purple400" />}
            label={t('Base')}
            onClick={onBaseBuildClick}
            onRemove={onClearBaseBuild}
          />
        ) : (
          <SelectBuild>
            <Text size="sm">{t('Select a build')}</Text>
          </SelectBuild>
        )}
      </Flex>

      {onTriggerComparison && (
        <Flex align="center" gap="sm">
          <Button
            onClick={() => {
              if (baseBuildDetails) {
                onTriggerComparison();
              }
            }}
            disabled={!baseBuildDetails || isComparing}
            priority="primary"
            icon={<IconTelescope size="sm" />}
          >
            {isComparing ? t('Comparing...') : t('Compare builds')}
          </Button>
        </Flex>
      )}
    </Flex>
  );
}

const BuildBranch = styled('span')`
  padding: ${p => p.theme.space['2xs']} ${p => p.theme.space.sm};
  background-color: ${p => p.theme.gray100};
  border-radius: ${p => p.theme.borderRadius};
`;

const SelectBuild = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  border-style: dashed;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
`;
