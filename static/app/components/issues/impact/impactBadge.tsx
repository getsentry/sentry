import {FeatureBadge, Tag} from '@sentry/scraps/badge';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Hovercard} from 'sentry/components/hovercard';
import {tct} from 'sentry/locale';

import {ImpactIcon} from './impactIcon';
import {getImpactLevelLabel, IMPACT_LEVEL_VARIANT, type AssessedImpact} from './utils';

type ImpactBadgeProps =
  | {
      /**
       * Show the description in a hovercard
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

  return <ImpactHovercard impact={props.impact}>{badge}</ImpactHovercard>;
}

function ImpactHovercard({
  impact,
  children,
}: {
  children: React.ReactNode;
  impact: AssessedImpact;
}) {
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
      {children}
    </Hovercard>
  );
}
