import {Container, Flex} from '@sentry/scraps/layout';
import type {LeadingGraphicProps} from '@sentry/scraps/leadingGraphic';
import {RevealOnHover} from '@sentry/scraps/revealOnHover';

import {EditableText} from 'sentry/components/editableText';

import type {BreadcrumbTitleActions} from './breadcrumbItemPageTitle';
import {renderTrailingActions} from './breadcrumbItemPageTitle';

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
  /** Trailing action slot — bounded to the component's compound parts. */
  trailingActions?: BreadcrumbTitleActions;
}

export function BreadcrumbItemPageTitleEditable({
  title,
  leadingGraphic,
  trailingActions,
}: BreadcrumbItemPageTitleEditableProps) {
  const actions = renderTrailingActions(trailingActions);

  return (
    // Mirrors BreadcrumbItemPageTitle's layout so the editable variant lines up
    // with the static one. RevealOnHover (render-prop form) reveals hover-only
    // trailing actions while keeping the inline `as="span"` element.
    <RevealOnHover>
      {({className}) => (
        <Flex
          as="span"
          className={className}
          align="center"
          gap="sm"
          height="32px"
          minWidth="32px"
          flexShrink={1}
        >
          {leadingGraphic}
          <Container minWidth={0} width="auto" data-test-id="breadcrumb-item">
            {title}
          </Container>
          {actions}
        </Flex>
      )}
    </RevealOnHover>
  );
}
