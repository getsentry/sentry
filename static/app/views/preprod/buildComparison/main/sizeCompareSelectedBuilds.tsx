import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout/flex';
import {Text} from 'sentry/components/core/text';
import {IconClose, IconCommit, IconFocus, IconLock, IconTelescope} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';

export interface SizeCompareSelectedBuildsProps {
  headBuildDetails: BuildDetailsApiResponse;
  isComparing: boolean;
  onClearBaseBuild: () => void;
  onTriggerComparison: () => void;
  baseBuildDetails?: BuildDetailsApiResponse;
}

export function SizeCompareSelectedBuilds({
  headBuildDetails,
  baseBuildDetails,
  isComparing,
  onClearBaseBuild,
  onTriggerComparison,
}: SizeCompareSelectedBuildsProps) {
  const headPrNumber = headBuildDetails.vcs_info?.pr_number;
  const headSha = headBuildDetails.vcs_info?.head_sha?.substring(0, 7);
  const headBranchName = headBuildDetails.vcs_info?.head_ref;

  const basePrNumber = baseBuildDetails?.vcs_info?.pr_number;
  const baseSha = baseBuildDetails?.vcs_info?.head_sha?.substring(0, 7);
  const baseBranchName = baseBuildDetails?.vcs_info?.head_ref;

  return (
    <Flex align="center" gap="lg" width="100%" justify="center">
      <Flex align="center" gap="sm">
        <IconLock size="xs" locked />
        <Text bold>{t('Your build:')}</Text>
        <Flex align="center" gap="md">
          {headPrNumber && (
            <Text size="sm" variant="accent" bold>
              {`#${headPrNumber} `}
            </Text>
          )}
          {headSha && (
            <Text size="sm" variant="accent" bold>
              <Flex align="center" gap="xs">
                <IconCommit size="xs" />
                {headSha}
              </Flex>
            </Text>
          )}
        </Flex>
        <BuildBranch>
          <Text size="sm" variant="muted">
            {headBranchName}
          </Text>
        </BuildBranch>
      </Flex>

      <Text>{t('vs')}</Text>

      <Flex align="center" gap="sm">
        {baseBuildDetails ? (
          <SelectedBaseBuild align="center" gap="sm">
            <IconFocus size="xs" color="purple400" />
            <Text size="sm" variant="accent" bold>
              {t('Comparison:')}
            </Text>
            {/* TODO */}
            <Text size="sm" variant="accent" bold>
              {basePrNumber && `#${basePrNumber} `}
              {baseSha && (
                <Flex align="center" gap="xs">
                  <IconCommit size="xs" color="purple400" />
                  {baseSha}
                </Flex>
              )}
            </Text>
            <BaseBuildBranch>
              <Text size="sm" variant="muted">
                {baseBranchName}
              </Text>
            </BaseBuildBranch>
            <Button
              onClick={e => {
                e.stopPropagation();
                onClearBaseBuild();
              }}
              size="zero"
              priority="transparent"
              borderless
              aria-label={t('Clear base build')}
              icon={<IconClose size="xs" color="purple400" />}
            />
          </SelectedBaseBuild>
        ) : (
          <SelectBuild>
            <Text size="sm">{t('Select a build')}</Text>
          </SelectBuild>
        )}
      </Flex>

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
    </Flex>
  );
}

const BuildBranch = styled('span')`
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.sm};
  background-color: ${p => p.theme.gray100};
  border-radius: ${p => p.theme.borderRadius};
`;

const BaseBuildBranch = styled('span')`
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

const SelectedBaseBuild = styled(Flex)`
  background-color: ${p => p.theme.surface100};
  border: 1px solid ${p => p.theme.focusBorder};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
`;
