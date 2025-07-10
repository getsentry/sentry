import {createContext, useContext, useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {
  OnboardingCodeSnippet,
  TabbedCodeSnippet,
} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCodeSnippet';
import type {ContentBlock} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {space} from 'sentry/styles/space';

type Renderer = {
  [key in ContentBlock['type']]: (
    block: Extract<ContentBlock, {type: key}>
  ) => React.ReactNode;
};

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
  renderer?: Partial<Renderer>;
  /**
   * The spacing between the content blocks.
   * Available as a CSS variable `var(--block-spacing)` for styling of child elements.
   */
  spacing?: string;
}

const RendererContext = createContext<
  | undefined
  | {
      renderer: Renderer;
    }
>(undefined);

const useRendererContext = () => {
  const context = useContext(RendererContext);
  if (!context) {
    throw new Error('useRendererContext must be used within a RendererContext');
  }
  return context;
};

function renderBlocks(
  contentBlocks: Array<ContentBlock | null | undefined>,
  renderer: Renderer
) {
  return contentBlocks.map((block, index) => {
    if (!block) {
      return null;
    }
    // Need to cast here as ts bugs out on the return type and does not allow assigning the key prop
    const RendererComponent = renderer[block.type] as (
      block: ContentBlock
    ) => React.ReactNode;

    return <RendererComponent {...block} key={String(index)} />;
  });
}

const defaultRenderer: Renderer = {
  text: TextBlock,
  code: CodeBlock,
  custom: CustomBlock,
  alert: AlertBlock,
  conditional: ConditionalBlock,
};

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
      ...defaultRenderer,
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
  --block-spacing: ${p => p.spacing};
`;

const baseBlockStyles = css`
  :not(:last-child) {
    margin-bottom: var(--block-spacing);
  }
`;

function TextBlock(block: Extract<ContentBlock, {type: 'text'}>) {
  return <TextBlockWrapper>{block.text}</TextBlockWrapper>;
}

const TextBlockWrapper = styled('div')`
  ${baseBlockStyles}

  code:not([class*='language-']) {
    color: ${p => p.theme.pink400};
  }
`;

function CustomBlock(block: Extract<ContentBlock, {type: 'custom'}>) {
  return <CustomBlockWrapper>{block.content}</CustomBlockWrapper>;
}

const CustomBlockWrapper = styled('div')`
  ${baseBlockStyles}
`;

function CodeBlock(block: Extract<ContentBlock, {type: 'code'}>) {
  if ('code' in block) {
    return (
      <div css={baseBlockStyles}>
        <OnboardingCodeSnippet language={block.language}>
          {block.code}
        </OnboardingCodeSnippet>
      </div>
    );
  }

  const tabsWithValues = block.tabs.map(tab => ({
    ...tab,
    value: tab.label,
  }));

  return (
    <div css={baseBlockStyles}>
      <TabbedCodeSnippet tabs={tabsWithValues} />
    </div>
  );
}

function AlertBlock({
  alertType,
  text,
  showIcon,
  system,
  trailingItems,
}: Extract<ContentBlock, {type: 'alert'}>) {
  return (
    <div css={baseBlockStyles}>
      <Alert
        type={alertType}
        showIcon={showIcon}
        system={system}
        trailingItems={trailingItems}
      >
        {text}
      </Alert>
    </div>
  );
}

function ConditionalBlock({
  condition,
  content,
}: Extract<ContentBlock, {type: 'conditional'}>) {
  const {renderer} = useRendererContext();

  if (condition) {
    return renderBlocks(content, renderer);
  }

  return null;
}
