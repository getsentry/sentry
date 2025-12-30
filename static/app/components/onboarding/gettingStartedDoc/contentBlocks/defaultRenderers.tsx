import {Fragment} from 'react';
import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {useRendererContext} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/rendererContext';
import type {
  BlockRenderers,
  ContentBlock,
} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/types';
import {
  ContentBlockCssVariables,
  renderBlocks,
} from 'sentry/components/onboarding/gettingStartedDoc/contentBlocks/utils';
import {
  OnboardingCodeSnippet,
  TabbedCodeSnippet,
} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCodeSnippet';

// TODO(aknaus): Remove !important once we can remove style overrides from the onboarding layouts
const baseBlockStyles = css`
  :not(:last-child) {
    margin-bottom: var(${ContentBlockCssVariables.BLOCK_SPACING}) !important;
  }
`;

const coloredCodeStyles = (theme: Theme) => css`
  code:not([class*='language-']) {
    color: ${theme.colors.pink500};
  }
`;

function AlertBlock({
  alertType,
  text,
  showIcon,
  system,
  trailingItems,
  icon,
}: Extract<ContentBlock, {type: 'alert'}>) {
  return (
    <div css={[baseBlockStyles, coloredCodeStyles]}>
      <Alert
        variant={alertType}
        showIcon={showIcon}
        system={system}
        trailingItems={trailingItems}
        icon={icon}
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
  return (
    <div css={block.bottomMargin === false ? undefined : baseBlockStyles}>
      {block.content}
    </div>
  );
}

function TextBlock(block: Extract<ContentBlock, {type: 'text'}>) {
  return (
    <TextBlockWrapper>
      {Array.isArray(block.text)
        ? block.text.map((text, index) => (
            <Fragment key={index}>
              {index > 0 && <br />}
              {text}
            </Fragment>
          ))
        : block.text}
    </TextBlockWrapper>
  );
}

const TextBlockWrapper = styled('div')`
  ${baseBlockStyles}
  white-space: pre-wrap;
  ${p => coloredCodeStyles(p.theme)}
`;

function SubHeaderBlock(block: Extract<ContentBlock, {type: 'subheader'}>) {
  // TODO(aknaus): Use <Heading/> throughout the onboarding docs codebase
  // <Heading as="h5"> has a different styling and does not match the other headings we currently use
  return <SubHeaderBlockWrapper>{block.text}</SubHeaderBlockWrapper>;
}

// TODO(aknaus): use <Heading/> instead
const SubHeaderBlockWrapper = styled('h5')`
  ${baseBlockStyles}
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: ${p => p.theme.fontWeight.bold};
  ${p => coloredCodeStyles(p.theme)}
`;

function ListBlock(block: Extract<ContentBlock, {type: 'list'}>) {
  return (
    <List symbol="bullet" css={baseBlockStyles}>
      {block.items.map((item, index) => (
        <ListItem css={coloredCodeStyles} key={index}>
          {item}
        </ListItem>
      ))}
    </List>
  );
}

export const defaultRenderers: BlockRenderers = {
  text: TextBlock,
  code: CodeBlock,
  custom: CustomBlock,
  alert: AlertBlock,
  conditional: ConditionalBlock,
  subheader: SubHeaderBlock,
  list: ListBlock,
};
