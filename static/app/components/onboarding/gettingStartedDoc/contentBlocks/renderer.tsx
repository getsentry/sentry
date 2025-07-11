import {useMemo} from 'react';
import styled from '@emotion/styled';

import {defaultRenderers} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/defaultRenderers';
import {RendererContext} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/rendererContext';
import type {
  BlockRenderers,
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
  renderer?: Partial<BlockRenderers>;
  /**
   * The spacing between the content blocks.
   * Available as a CSS variable `var(${CssVariables.BLOCK_SPACING})` for styling of child elements.
   */
  spacing?: string;
}

const NO_RENDERERS = {};
const DEFAULT_SPACING = space(2);

export function ContentBlocksRenderer({
  contentBlocks,
  renderer: customRenderers = NO_RENDERERS,
  spacing = DEFAULT_SPACING,
  className,
}: Props) {
  const contextValue = useMemo(
    () => ({
      renderers: {
        ...defaultRenderers,
        ...customRenderers,
      },
    }),
    [customRenderers]
  );
  return (
    <RendererContext value={contextValue}>
      <Wrapper className={className} spacing={spacing}>
        {renderBlocks(contentBlocks, contextValue.renderers)}
      </Wrapper>
    </RendererContext>
  );
}

const Wrapper = styled('div')<{spacing: string}>`
  ${CssVariables.BLOCK_SPACING}: ${p => p.spacing};
`;
