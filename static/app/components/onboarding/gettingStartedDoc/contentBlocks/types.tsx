import type {AlertProps} from 'sentry/components/core/alert';
import type {CodeSnippetTab} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCodeSnippet';

type BaseBlock<T extends string> = {
  type: T;
};

/**
 * Renders the Alert component
 */
type AlertBlock = BaseBlock<'alert'> & {
  alertType: AlertProps['variant'];
  text: React.ReactNode;
  type: 'alert';
  icon?: AlertProps['icon'];
  showIcon?: AlertProps['showIcon'];
  system?: AlertProps['system'];
  trailingItems?: AlertProps['trailingItems'];
};

// The value of the tab is omitted and inferred from the label in the renderer
type CodeTabWithoutValue = Omit<CodeSnippetTab, 'value'>;
type SingleCodeBlock = BaseBlock<'code'> & Omit<CodeTabWithoutValue, 'label'>;
type MultipleCodeBlock = BaseBlock<'code'> & {
  tabs: CodeTabWithoutValue[];
};
/**
 * Code blocks can either render a single code snippet or multiple code snippets in a tabbed interface.
 */
type CodeBlock = SingleCodeBlock | MultipleCodeBlock;

/**
 * Conditional blocks are used to render content based on a condition.
 */
type ConditionalBlock = BaseBlock<'conditional'> & {
  condition: boolean;
  content: ContentBlock[];
};

/**
 * Text blocks are used to render one paragraph of text.
 */
type TextBlock = BaseBlock<'text'> & {
  /**
   * Only meant for text or return values of translation functions (t, tct, tn).
   *
   * **Do not** use this with custom react elements but instead use the `custom` block type.
   */
  text: React.ReactNode;
};

/**
 * Subheader blocks are used to render a subheader.
 */
type SubHeaderBlock = BaseBlock<'subheader'> & {
  text: React.ReactNode;
};

/**
 * List blocks are used to render a list of items.
 */
type ListBlock = BaseBlock<'list'> & {
  items: React.ReactNode[];
};

/**
 * Custom blocks can be used to render any content that is not covered by the other block types.
 */
type CustomBlock = BaseBlock<'custom'> & {
  content: React.ReactNode;
  bottomMargin?: boolean;
};

export type ContentBlock =
  | AlertBlock
  | CodeBlock
  | ConditionalBlock
  | CustomBlock
  | TextBlock
  | SubHeaderBlock
  | ListBlock;

export type BlockRenderers = {
  [key in ContentBlock['type']]: (
    block: Extract<ContentBlock, {type: key}>
  ) => React.ReactNode;
};
