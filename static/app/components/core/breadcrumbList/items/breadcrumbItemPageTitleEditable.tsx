import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {EditableText} from 'sentry/components/editableText';

import {BreadcrumbLeadingSlot} from './breadcrumbLeadingSlot';

export interface BreadcrumbItemPageTitleEditableProps {
  /** Accessible name for the editable input. */
  'aria-label': string;
  onChange: (value: string) => void;
  value: string;
  /** When true, clearing + blurring cancels the edit instead of erroring. */
  allowEmpty?: boolean;
  autoSelect?: boolean;
  errorMessage?: React.ReactNode;
  isDisabled?: boolean;
  /**
   * Decorative 16×16 leading graphic — a `ProjectsBadge`, avatar, or icon.
   * Rendered aria-hidden inside a fixed-size slot; the label carries the meaning.
   */
  leadingGraphic?: React.ReactNode;
  maxLength?: number;
  placeholder?: string;
}

export function BreadcrumbItemPageTitleEditable({
  leadingGraphic,
  ...editableTextProps
}: BreadcrumbItemPageTitleEditableProps) {
  return (
    // Mirrors BreadcrumbItemPageTitle's layout so the editable variant lines up
    // with the static one. No trailing-action slot: EditableText owns its own
    // edit affordance.
    <Flex as="span" align="center" gap="sm" height="32px" minWidth="32px">
      {leadingGraphic && <BreadcrumbLeadingSlot>{leadingGraphic}</BreadcrumbLeadingSlot>}
      {/* Bold wrapper matches BreadcrumbItemPageTitle's weight; EditableText's
          compact label/input inherit font-weight from this context. */}
      <Container minWidth={0}>
        <Text as="span" bold>
          <EditableText variant="compact" {...editableTextProps} />
        </Text>
      </Container>
    </Flex>
  );
}
