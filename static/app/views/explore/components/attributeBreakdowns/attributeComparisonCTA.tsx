import React from 'react';
import styled from '@emotion/styled';

import emptyTraceImg from 'sentry-images/spot/performance-empty-trace.svg';

import {Flex} from '@sentry/scraps/layout/flex';
import {Text} from '@sentry/scraps/text';

import {Button} from 'sentry/components/core/button';
import Panel from 'sentry/components/panels/panel';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {Tab, useTab} from 'sentry/views/explore/hooks/useTab';

import {useChartSelection} from './chartSelectionContext';

const PANEL_WIDTH = '400px';
const ILLUSTRATION_HEIGHT = '120px';
const LOCAL_STORAGE_KEY = 'explore:attribute-breakdowns-cta-dismissed';
const CTA_DELAY_MS = 1000;

export function AttributeComparisonCTA({children}: {children: React.ReactNode}) {
  const [tab] = useTab();
  const {chartSelection} = useChartSelection();
  const [isDismissed, setIsDismissed] = useLocalStorageState<boolean>(
    LOCAL_STORAGE_KEY,
    false
  );

  const isAttributeBreakdownsTab = tab === Tab.ATTRIBUTE_BREAKDOWNS;
  const showCTA = !chartSelection && !isDismissed && isAttributeBreakdownsTab;

  // Adding a delay so the CTA appears after we have switched
  // to the attribute breakdowns tab and draws attention
  const showDelayed = useDebouncedValue(showCTA, CTA_DELAY_MS);

  return (
    <Wrapper>
      {children}
      {showDelayed && showCTA ? (
        <Content>
          <Flex
            direction="column"
            gap="sm"
            paddingTop="md"
            paddingBottom="md"
            paddingLeft="lg"
            paddingRight="md"
          >
            <Flex align="center" justify="between">
              <Text bold size="sm" align="left">
                {t('Examine what sets your selection apart')}
              </Text>
              <Button
                size="zero"
                icon={<IconClose size="sm" />}
                borderless
                aria-label={t('Attribute Breakdowns CTA dismissed')}
                onClick={() => setIsDismissed(true)}
              />
            </Flex>
            <Text size="xs" align="left">
              {t(
                "Drag to select an area on the chart and click 'Compare Attribute Breakdowns' to analyze differences between selected and unselected (baseline) data:"
              )}
            </Text>
            <IllustrationWrapper>
              <Illustration src={emptyTraceImg} alt="Attribute breakdowns illustration" />
            </IllustrationWrapper>
          </Flex>
          <Arrow />
        </Content>
      ) : null}
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  position: relative;
`;

const Content = styled(Panel)`
  position: absolute;
  left: 50%;
  top: 40px;
  width: ${PANEL_WIDTH};
  transform: translate(-50%, -100%);
  z-index: ${p => p.theme.zIndex.modal};
`;

const Arrow = styled('div')`
  top: 100%;
  left: 50%;
  position: absolute;
  pointer-events: none;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid ${p => p.theme.background};
  margin-left: -8px;
  &:before {
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-top: 8px solid ${p => p.theme.translucentBorder};
    content: '';
    display: block;
    position: absolute;
    top: -7px;
    left: -8px;
    z-index: -1;
  }
`;

const IllustrationWrapper = styled('div')`
  position: relative;
  height: ${ILLUSTRATION_HEIGHT};
  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    display: none;
  }
`;

const Illustration = styled('img')`
  position: absolute;
  display: block;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  height: 100%;
  overflow: hidden;
`;
