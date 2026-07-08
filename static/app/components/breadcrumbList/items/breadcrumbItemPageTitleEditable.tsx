import {Container, Flex} from '@sentry/scraps/layout';
import type {LeadingGraphicProps} from '@sentry/scraps/leadingGraphic';
import {Text} from '@sentry/scraps/text';

import {EditableText} from 'sentry/components/editableText';

export interface BreadcrumbEditableTitleProps {
  /** Accessible name for the editable input. */
  'aria-label': string;
  onChange: (value: string) => void;
  value: string;
  /** When true, clearing + blurring cancels the edit instead of erroring. */
  allowEmpty?: boolean;
  autoSelect?: boolean;
  errorMessage?: React.ReactNode;
  isDisabled?: boolean;
  maxLength?: number;
  placeholder?: string;
}

/**
 * `BreadcrumbList.EditableTitle` — a click-to-edit current-page title. Thin
 * wrapper over `EditableText` in its `compact` variant so it inherits the crumb
 * row's font-size/weight and edits inline. Same element-slot idiom as
 * `leadingGraphic`: consumers pass a `<BreadcrumbList.EditableTitle />` element
 * as the `title` prop of the `editable-title` item.
 */
export function BreadcrumbEditableTitle(props: BreadcrumbEditableTitleProps) {
  return <EditableText variant="compact" {...props} />;
}

export interface BreadcrumbItemPageTitleEditableProps {
  /** A `<BreadcrumbList.EditableTitle />` element. */
  title: React.ReactElement<BreadcrumbEditableTitleProps>;
  leadingGraphic?: React.ReactElement<LeadingGraphicProps>;
}

export function BreadcrumbItemPageTitleEditable({
  title,
  leadingGraphic,
}: BreadcrumbItemPageTitleEditableProps) {
  return (
    // Mirrors BreadcrumbItemPageTitle's layout so the editable variant lines up
    // with the static one. No trailing-action slot: EditableText owns its own
    // edit affordance, so (unlike page-title) there is nothing to reveal on hover.
    <Flex as="span" align="center" gap="sm" height="32px" minWidth="32px" flexShrink={1}>
      {leadingGraphic}
      {/* Bold wrapper matches BreadcrumbItemPageTitle's weight; EditableText's
          compact label/input inherit font-weight from this context. */}
      <Container minWidth={0} width="auto" data-test-id="breadcrumb-item">
        <Text as="div" bold>
          {title}
        </Text>
      </Container>
    </Flex>
  );
}
