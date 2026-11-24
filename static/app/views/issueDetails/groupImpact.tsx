import {IconAdd} from '@sentry/icons/add';
import {IconChevron} from '@sentry/icons/chevron';
import {IconSubtract} from '@sentry/icons/subtract';
import type {SVGIconProps} from '@sentry/icons/svgIcon';
import {useMutation} from '@tanstack/react-query';

import {FeatureBadge, Tag} from '@sentry/scraps/badge';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {IssueSidebarButton} from 'sentry/components/group/issueSidebarButton';
import {Hovercard} from 'sentry/components/hovercard';
import {t, tct} from 'sentry/locale';
import type {Group, ImpactAssessment, ImpactLevel} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

import {InlineChip} from './activitySection/activityLineItem/chips/inlineChip';

function getImpactLevelLabel(level: ImpactLevel) {
  switch (level) {
    case 'super_low':
      return t('Super Low');
    case 'low':
      return t('Low');
    case 'moderate':
      return t('Moderate');
    case 'high':
      return t('High');
    case 'super_high':
      return t('Super High');
  }
}

const IMPACT_LEVEL_VARIANT = {
  super_low: 'success',
  low: 'success',
  moderate: 'warning',
  high: 'danger',
  super_high: 'danger',
} as const satisfies Record<ImpactLevel, SVGIconProps['variant']>;

function ImpactIcon({level, ...rest}: SVGIconProps & {level: ImpactLevel}) {
  const props = {variant: IMPACT_LEVEL_VARIANT[level], ...rest};
  switch (level) {
    case 'super_low':
      return <IconChevron {...props} direction="down" isDouble />;
    case 'low':
      return <IconChevron {...props} direction="down" />;
    case 'moderate':
      return <IconSubtract {...props} />;
    case 'high':
      return <IconChevron {...props} direction="up" />;
    case 'super_high':
      return <IconChevron {...props} direction="up" isDouble />;
  }
}

/**
 * Whether the organization can see impact assessments.
 * Currently, the API won't have impact assessments in the results without the flag,
 * but that may change, so check the flag on the frontend as well.
 */
export function hasImpactAssessment(organization: Organization) {
  return organization.features.includes('seer-impact-assessment');
}

export function useHasImpactAssessment() {
  return hasImpactAssessment(useOrganization());
}

/**
 * Returns the group's impact assessment when it has a level and score, if available
 */
export function useAssessedImpact(group: Group) {
  const canSeeImpact = useHasImpactAssessment();
  const impact = group.derivedData?.impact;
  return canSeeImpact && impact?.level && impact.score !== null
    ? (impact as ImpactAssessment & {level: ImpactLevel; score: number})
    : null;
}

export function ImpactChip({level, score}: {level: ImpactLevel; score: number}) {
  return (
    <InlineChip variant="compactLeading">
      <ImpactIcon size="xs" level={level} />
      {getImpactLevelLabel(level)} ({score})
    </InlineChip>
  );
}

export function GroupImpactBadge({group}: {group: Group}) {
  const impact = useAssessedImpact(group);
  if (!impact) {
    return null;
  }

  return (
    <Hovercard
      position="top"
      header={
        <Flex align="center" gap="md">
          <FeatureBadge type="alpha" tooltipProps={{disabled: true}} />
          <Text size="sm">
            {tct('This issue has a [level] impact on users', {
              level: (
                <Text
                  as="span"
                  size="sm"
                  bold
                  variant={IMPACT_LEVEL_VARIANT[impact.level]}
                >
                  {getImpactLevelLabel(impact.level)}
                </Text>
              ),
            })}
          </Text>
        </Flex>
      }
      body={<Text size="sm">{impact.description}</Text>}
    >
      <Tag variant="muted" icon={<ImpactIcon level={impact.level} />}>
        {getImpactLevelLabel(impact.level)} ({impact.score})
      </Tag>
    </Hovercard>
  );
}

export function useAssessImpact(group: Group) {
  const organization = useOrganization();
  return useMutation({
    mutationFn: () =>
      fetchMutation<{runId: string}>({
        method: 'POST',
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/issues/$issueId/impact/assess/',
          {path: {organizationIdOrSlug: organization.slug, issueId: group.id}}
        ),
      }),
    onMutate: () => {
      toast.loading(t('Starting impact assessment\u2026'));
    },
    onError: () => {
      toast.error(t('Unable to start impact assessment'));
    },
  });
}

export function AssessImpactButton({group}: {group: Group}) {
  const {mutate: assessImpact, isPending} = useAssessImpact(group);

  return (
    <IssueSidebarButton
      busy={isPending}
      icon={<IconAdd />}
      onClick={() => assessImpact()}
      size="zero"
      variant="transparent"
    >
      {t('Assess impact')}
    </IssueSidebarButton>
  );
}
