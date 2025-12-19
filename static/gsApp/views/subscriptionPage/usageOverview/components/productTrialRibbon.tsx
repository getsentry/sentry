import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tooltip} from '@sentry/scraps/tooltip';

import {Flex} from 'sentry/components/core/layout';
import {IconClock, IconLightning} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import getDaysSinceDate from 'sentry/utils/getDaysSinceDate';

import {type ProductTrial} from 'getsentry/types';

function ProductTrialRibbon({
  activeProductTrial,
  potentialProductTrial,
}: {
  activeProductTrial: ProductTrial | null;
  potentialProductTrial: ProductTrial | null;
}) {
  const theme = useTheme();
  const ribbonColor = activeProductTrial
    ? theme.tokens.graphics.promotion
    : theme.tokens.graphics.accent;

  if (!activeProductTrial && !potentialProductTrial) {
    return null;
  }

  const trialDaysLeft = -1 * getDaysSinceDate(activeProductTrial?.endDate ?? '');
  const tooltipContent = activeProductTrial
    ? tn('%s day left', '%s days left', trialDaysLeft)
    : t('Trial available');

  return (
    <RibbonContainer>
      <RibbonBase ribbonColor={ribbonColor}>
        <Tooltip title={tooltipContent}>
          {activeProductTrial ? (
            <StyledIconClock size="xs" />
          ) : (
            <StyledIconLightning size="xs" />
          )}
        </Tooltip>
      </RibbonBase>
      <Flex direction="column" position="relative">
        <TopRibbonEdge ribbonColor={ribbonColor} />
        <BottomRibbonEdge ribbonColor={ribbonColor} />
      </Flex>
    </RibbonContainer>
  );
}

export default ProductTrialRibbon;

const StyledIconClock = styled(IconClock)`
  color: ${p => p.theme.colors.white};
`;

const StyledIconLightning = styled(IconLightning)`
  color: ${p => p.theme.colors.white};
`;

const RibbonContainer = styled('td')`
  display: flex;
  position: absolute;
  left: -1px;
  top: 14px;
  z-index: 1000;
`;

const RibbonBase = styled('div')<{ribbonColor: string}>`
  width: 20px;
  height: 22px;
  background: ${p => p.ribbonColor};
  padding: ${p => `${p.theme.space['2xs']} ${p.theme.space.xs}`};
`;

const BottomRibbonEdge = styled('div')<{ribbonColor: string}>`
  position: absolute;
  top: auto;
  bottom: 0;
  width: 0px;
  height: 0px;
  border-style: solid;
  border-color: transparent transparent ${p => p.ribbonColor} transparent;
  border-width: 11px 5.5px 11px 0px;
`;

const TopRibbonEdge = styled(BottomRibbonEdge)`
  transform: scaleY(-1);
  top: 0;
  bottom: auto;
`;
