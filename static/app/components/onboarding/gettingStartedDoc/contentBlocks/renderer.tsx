import {useMemo} from 'react';
import styled from '@emotion/styled';

import {defaultBlocks} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/defaultBlocks';
import {RendererContext} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/rendererContext';
import type {
  BlockRenderer,
  ContentBlock,
} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/types';
import {
  CssVariables,
  renderBlocks,
} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/utils';
import {space} from 'sentry/styles/space';

interface Props {
  /**
   * The content blocks to be rendered.
   */
  contentBlocks: Array<ContentBlock | null | undefined>;
  /**
   * The class name to be applied to the root element.
   */
  className?: string;
  /**
   * A custom renderer for the content blocks.
   * If not provided, the default renderer will be used.
   * The renderer object must have a key for each content block type.
   */
  renderer?: Partial<BlockRenderer>;
  /**
   * The spacing between the content blocks.
   * Available as a CSS variable `var(--block-spacing)` for styling of child elements.
   */
  spacing?: string;
}

const NO_RENDERER = {};
const DEFAULT_SPACING = space(2);

export function ContentBlocksRenderer({
  contentBlocks,
  renderer: customRenderer = NO_RENDERER,
  spacing = DEFAULT_SPACING,
  className,
}: Props) {
  const renderer = useMemo(
    () => ({
      ...defaultBlocks,
      ...customRenderer,
    }),
    [customRenderer]
  );
  return (
    <RendererContext value={{renderer}}>
      <Wrapper className={className} spacing={spacing}>
        {renderBlocks(contentBlocks, renderer)}
      </Wrapper>
    </RendererContext>
  );
}

const Wrapper = styled('div')<{spacing: string}>`
  ${CssVariables.BLOCK_SPACING}: ${p => p.spacing};
`;
