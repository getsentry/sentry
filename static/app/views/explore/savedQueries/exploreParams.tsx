import {useCallback, useLayoutEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {Flex} from '@sentry/scraps/layout';

import {Tooltip} from 'sentry/components/core/tooltip';
import {ProvidedFormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {getFieldDefinition} from 'sentry/utils/fields';
import {useDimensions} from 'sentry/utils/useDimensions';
import type {BaseVisualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {prettifyAggregation} from 'sentry/views/explore/utils';

const MORE_TOKENS_WIDTH = 32;

type SingleQueryProps = {
  query: string;
  visualizes: BaseVisualize[];
  groupBys?: string[]; // This needs to be passed in because saveQuery relies on being within the Explore PageParamsContext to fetch params
};

export function ExploreParams({
  query,
  visualizes,
  groupBys,
  className,
}: SingleQueryProps & {className?: string}) {
  const yAxes = visualizes.flatMap(visualize => visualize.yAxes);
  const containerRef = useRef<HTMLSpanElement>(null);

  const {width} = useDimensions({elementRef: containerRef});
  const [childWidths, setChildWidths] = useState<number[]>([]);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  const debouncedSetContainerWidth = useMemo(
    () =>
      debounce((newWidth: number) => {
        setContainerWidth(newWidth);
      }, 30),
    []
  );

  useLayoutEffect(() => {
    debouncedSetContainerWidth(width - MORE_TOKENS_WIDTH);
  }, [debouncedSetContainerWidth, width]);

  useLayoutEffect(() => {
    if (containerRef.current?.children) {
      const children = Array.from(containerRef.current.children);
      setChildWidths(children.map(child => child.getBoundingClientRect().width));
    }
  }, [containerRef]);

  // Calculates the index of the last token that is safe to show without overflowing
  const calculateTokensToShow = useCallback(() => {
    if (childWidths.length > 0) {
      let totalWidth = 0;
      let lastVisibleIndex = childWidths.length - 1;

      childWidths.some((childWidth, index) => {
        const newTotalWidth = totalWidth + childWidth + (index > 0 ? 8 : 0);

        if (newTotalWidth > containerWidth) {
          lastVisibleIndex = Math.max(0, index - 1);
          return true;
        }

        totalWidth = newTotalWidth;
        return false;
      });

      return lastVisibleIndex;
    }
    return null;
  }, [childWidths, containerWidth]);

  const tokens = [];
  if (visualizes.length > 0) {
    tokens.push(
      <Flex as="span" wrap="wrap" gap="xs" overflow="hidden" key="visualize">
        <ExploreParamTitle>{t('Visualize')}</ExploreParamTitle>
      </Flex>
    );
    yAxes.forEach((yAxis, index) => {
      tokens.push(
        <Flex as="span" wrap="wrap" gap="xs" overflow="hidden" key={`visualize-${index}`}>
          <ExploreVisualizes>{prettifyAggregation(yAxis) ?? yAxis}</ExploreVisualizes>
        </Flex>
      );
    });
  }
  const parsedQuery = useMemo(() => {
    return parseQueryBuilderValue(query, getFieldDefinition);
  }, [query]);
  if (query) {
    tokens.push(
      <Flex as="span" wrap="wrap" gap="xs" overflow="hidden" key="filter">
        <ExploreParamTitle>{t('Filter')}</ExploreParamTitle>
      </Flex>
    );
    parsedQuery
      ?.filter(({text}) => text.trim() !== '')
      .forEach(({text}, index) => {
        tokens.push(
          <Flex as="span" wrap="wrap" gap="xs" overflow="hidden" key={`filter-${index}`}>
            <FormattedQueryWrapper>
              <ProvidedFormattedQuery query={text} />
            </FormattedQueryWrapper>
          </Flex>
        );
      });
  }
  if (groupBys && groupBys.length > 0) {
    tokens.push(
      <Flex as="span" wrap="wrap" gap="xs" overflow="hidden" key="groupBy">
        <ExploreParamTitle>{t('Group By')}</ExploreParamTitle>
      </Flex>
    );
    groupBys.forEach((groupBy, index) => {
      tokens.push(
        <Flex as="span" wrap="wrap" gap="xs" overflow="hidden" key={`groupBy-${index}`}>
          <ExploreGroupBys key={groupBy}>{groupBy}</ExploreGroupBys>
        </Flex>
      );
    });
  }

  const tokensToShow = calculateTokensToShow();
  const visibleTokens = defined(tokensToShow)
    ? tokens.slice(0, tokensToShow + 1)
    : tokens;
  const hiddenTokens = defined(tokensToShow) ? tokens.slice(tokensToShow + 1) : [];

  if (defined(tokensToShow) && tokensToShow + 1 < tokens.length) {
    visibleTokens.push(
      <Tooltip
        key="more"
        title={
          <Flex as="span" wrap="wrap" gap="xs">
            {hiddenTokens}
          </Flex>
        }
      >
        <Flex as="span" wrap="wrap" gap="xs" overflow="hidden">
          <ExploreMoreTokens>
            {'+' + (tokens.length - tokensToShow - 1)}
          </ExploreMoreTokens>
        </Flex>
      </Tooltip>
    );
  }

  return (
    <Flex
      as="span"
      wrap="wrap"
      marginBottom="xl"
      gap="md"
      width="100%"
      className={className}
      ref={containerRef}
    >
      {visibleTokens}
    </Flex>
  );
}

const ExploreParamTitle = styled('span')`
  font-size: ${p => p.theme.form.sm.fontSize};
  color: ${p => p.theme.tokens.content.secondary};
  white-space: nowrap;
  padding-top: 3px;
`;

const ExploreVisualizes = styled('span')`
  font-size: ${p => p.theme.form.sm.fontSize};
  background: ${p => p.theme.tokens.background.primary};
  padding: ${space(0.25)} ${space(0.5)};
  border: 1px solid ${p => p.theme.tokens.border.secondary};
  border-radius: ${p => p.theme.radius.md};
  height: 24px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

const ExploreGroupBys = ExploreVisualizes;
const ExploreMoreTokens = ExploreVisualizes;

const FormattedQueryWrapper = styled('span')`
  display: inline-block;
  font-size: ${p => p.theme.form.sm.fontSize};
`;
