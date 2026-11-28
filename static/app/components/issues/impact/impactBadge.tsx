import {Fragment, useState} from 'react';

import {FeatureBadge, Tag} from '@sentry/scraps/badge';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Hovercard} from 'sentry/components/hovercard';
import {tct} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {useOrganization} from 'sentry/utils/useOrganization';

import {ImpactFeedback} from './impactFeedback';
import {ImpactIcon} from './impactIcon';
import {
  getImpactLevelLabel,
  hasImpactFeedback,
  IMPACT_LEVEL_VARIANT,
  type AssessedImpact,
} from './utils';

type ImpactBadgeProps =
  | {
      group: Group;
      /**
       * Show the description and feedback controls in a hovercard
       */
      hovercard: true;
      impact: AssessedImpact;
    }
  | {impact: Pick<AssessedImpact, 'level' | 'score'>; hovercard?: false};

export function ImpactBadge(props: ImpactBadgeProps) {
  const {level, score} = props.impact;
  const badge = (
    <Tag variant="muted" icon={<ImpactIcon level={level} />}>
      {getImpactLevelLabel(level)} ({score})
    </Tag>
  );

  if (!props.hovercard) {
    return badge;
  }

  return (
    <ImpactHovercard impact={props.impact} group={props.group}>
      {badge}
    </ImpactHovercard>
  );
}

function ImpactHovercard({
  impact,
  group,
  children,
}: {
  children: React.ReactNode;
  group: Group;
  impact: AssessedImpact;
}) {
  const organization = useOrganization();
  const [isCorrecting, setIsCorrecting] = useState(false);

  return (
    <Hovercard
      position="top"
      // The level picker's menu renders outside the hovercard, so keep the
      // hovercard open while a correction is in progress.
      forceVisible={isCorrecting ? true : undefined}
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
      body={
        <Stack gap="md">
          <Text size="sm">{impact.description}</Text>
          {hasImpactFeedback(organization) && (
            <Fragment>
              <Stack.Separator border="secondary" />
              <ImpactFeedback
                impact={impact}
                group={group}
                onCorrectingChange={setIsCorrecting}
              />
            </Fragment>
          )}
        </Stack>
      }
    >
      {children}
    </Hovercard>
  );
}
