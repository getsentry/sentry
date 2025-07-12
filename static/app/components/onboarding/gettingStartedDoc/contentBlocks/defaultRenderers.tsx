import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {useRendererContext} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/rendererContext';
import type {
  BlockRenderers,
  ContentBlock,
} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/types';
import {
  CssVariables,
  renderBlocks,
} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/utils';
import {
  OnboardingCodeSnippet,
  TabbedCodeSnippet,
} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCodeSnippet';

const baseBlockStyles = css`
  :not(:last-child) {
    margin-bottom: var(${CssVariables.BLOCK_SPACING});
  }
`;

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

function ConditionalBlock({
  condition,
  content,
}: Extract<ContentBlock, {type: 'conditional'}>) {
  const {renderers} = useRendererContext();

  if (condition) {
    return renderBlocks(content, renderers);
  }

  return null;
}

function CustomBlock(block: Extract<ContentBlock, {type: 'custom'}>) {
  return <div css={baseBlockStyles}>{block.content}</div>;
}

function TextBlock(block: Extract<ContentBlock, {type: 'text'}>) {
  return <TextBlockWrapper>{block.text}</TextBlockWrapper>;
}

const TextBlockWrapper = styled('div')`
  ${baseBlockStyles}

  code:not([class*='language-']) {
    color: ${p => p.theme.pink400};
  }
`;

export const defaultRenderers: BlockRenderers = {
  text: TextBlock,
  code: CodeBlock,
  custom: CustomBlock,
  alert: AlertBlock,
  conditional: ConditionalBlock,
};
