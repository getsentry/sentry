import {useCallback} from 'react';
import type {TooltipComponentFormatterCallbackParams} from 'echarts';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {useRenderToString} from '@sentry/scraps/renderToString';
import {Text} from '@sentry/scraps/text';

import {
  CHART_BASELINE_SERIES_NAME,
  CHART_SELECTED_SERIES_NAME,
  CHART_TOOLTIP_MAX_VALUE_LENGTH,
} from './constants';
import {percentageFormatter} from './utils';

export function useFormatSingleModeTooltip() {
  const renderToString = useRenderToString();

  return useCallback(
    (p: TooltipComponentFormatterCallbackParams) => {
      const data = Array.isArray(p) ? p[0]?.data : p.data;
      const pct = percentageFormatter(Number(data));

      const value = Array.isArray(p) ? p[0]?.name : p.name;
      const truncatedValue = value
        ? value.length > CHART_TOOLTIP_MAX_VALUE_LENGTH
          ? `${value.slice(0, CHART_TOOLTIP_MAX_VALUE_LENGTH)}...`
          : value
        : '\u2014';

      return renderToString(
        // need to set padding on the `style` prop directly because the `padding` props
        // is being overridden by the `className` prop
        <Container className="tooltip-series" style={{padding: 0}}>
          <Flex
            className="tooltip-label"
            justify="between"
            gap="2xl"
            padding="md xl"
            minWidth="100px"
            maxWidth="300px"
            style={{margin: '0 auto', cursor: 'default'}}
          >
            <strong
              style={{
                wordBreak: 'break-word',
                whiteSpace: 'normal',
                overflowWrap: 'anywhere',
                textAlign: 'center',
              }}
            >
              {truncatedValue}
            </strong>
            <Text size="sm" variant="muted">
              {pct}
            </Text>
          </Flex>
        </Container>
      );
    },
    [renderToString]
  );
}

export function useFormatComparisonModeTooltip(
  primaryColor: string,
  secondaryColor: string
) {
  const renderToString = useRenderToString();

  return useCallback(
    (p: TooltipComponentFormatterCallbackParams) => {
      if (!Array.isArray(p)) {
        return '\u2014';
      }

      const selectedParam = p.find(s => s.seriesName === CHART_SELECTED_SERIES_NAME);
      const baselineParam = p.find(s => s.seriesName === CHART_BASELINE_SERIES_NAME);

      if (!selectedParam || !baselineParam) {
        return '\u2014';
      }

      const selectedValue = selectedParam.value;
      const baselineValue = baselineParam.value;
      const selectedPct = percentageFormatter(Number(selectedValue));
      const baselinePct = percentageFormatter(Number(baselineValue));

      const name = selectedParam.name ?? baselineParam.name ?? '';
      const truncatedName =
        name.length > CHART_TOOLTIP_MAX_VALUE_LENGTH
          ? `${name.slice(0, CHART_TOOLTIP_MAX_VALUE_LENGTH)}...`
          : name;

      return renderToString(
        <Container className="tooltip-series" style={{padding: 0}}>
          <Stack
            className="tooltip-label"
            align="stretch"
            gap="md"
            padding="md xl"
            minWidth="100px"
            maxWidth="300px"
            style={{margin: '0 auto', cursor: 'default'}}
          >
            <strong
              style={{
                wordBreak: 'break-word',
                whiteSpace: 'normal',
                overflowWrap: 'anywhere',
                textAlign: 'center',
              }}
            >
              {truncatedName}
            </strong>
            <Flex as="span" align="center" justify="between" gap="2xl">
              <Flex align="center" gap="sm">
                <Container
                  width="8px"
                  height="8px"
                  radius="md"
                  display="inline-block"
                  style={{backgroundColor: primaryColor}}
                />
                <Text>selected</Text>
              </Flex>
              <Text size="sm" variant="muted">
                {selectedPct}
              </Text>
            </Flex>
            <Flex as="span" align="center" justify="between" gap="2xl">
              <Flex align="center" gap="sm">
                <Container
                  width="8px"
                  height="8px"
                  radius="md"
                  display="inline-block"
                  style={{backgroundColor: secondaryColor}}
                />
                <Text>baseline</Text>
              </Flex>
              <Text size="sm" variant="muted">
                {baselinePct}
              </Text>
            </Flex>
          </Stack>
        </Container>
      );
    },
    [primaryColor, secondaryColor, renderToString]
  );
}
