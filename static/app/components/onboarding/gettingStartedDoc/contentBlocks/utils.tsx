import type {
  BlockRenderer,
  ContentBlock,
} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/types';

export enum CssVariables {
  BLOCK_SPACING = '--block-spacing',
}

export function renderBlocks(
  contentBlocks: Array<ContentBlock | null | undefined>,
  renderer: BlockRenderer
) {
  return contentBlocks.map((block, index) => {
    if (!block) {
      return null;
    }
    // Need to cast here as ts bugs out on the return type and does not allow assigning the key prop
    const RendererComponent = renderer[block.type] as (
      block: ContentBlock
    ) => React.ReactNode;

    // The index actually works well as a key here
    // as long as the conditional block is used instead of JS logic to edit the blocks array
    return <RendererComponent {...block} key={index} />;
  });
}
