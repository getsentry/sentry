import {BreadcrumbTrailingActions} from '@sentry/scraps/breadcrumbList/actions/breadcrumbTrailingActions';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex} from '@sentry/scraps/layout';

import {BreadcrumbLeadingSlot} from './breadcrumbLeadingSlot';

export interface BreadcrumbItemCurrentProps {
  label: string;
  /**
   * Always-on tooltip on the label, for context the label cannot carry itself
   * (e.g. the event ID the current view belongs to).
   */
  labelTooltip?: React.ReactNode;
  /**
   * Decorative 16×16 leading graphic — a `ProjectsBadge`, avatar, or icon.
   * Rendered aria-hidden inside a fixed-size slot; the label carries the meaning.
   */
  leadingGraphic?: React.ReactNode;
  /**
   * Typed trailing actions about the current item, such as exporting it or
   * opening its full view. Rendered after the label.
   */
  trailingActions?: BreadcrumbTrailingActions;
}

/**
 * The current location in a breadcrumb trail that is not the page itself, such
 * as a drawer or panel. Unlike the page title, it does not render a heading.
 */
export function BreadcrumbItemCurrent({
  label,
  labelTooltip,
  leadingGraphic,
  trailingActions,
}: BreadcrumbItemCurrentProps) {
  return (
    <Flex align="center" gap="sm" height="32px" minWidth="32px">
      {leadingGraphic && <BreadcrumbLeadingSlot>{leadingGraphic}</BreadcrumbLeadingSlot>}
      {/* minWidth={0} lets the label shrink. The visible-width floor lives on
          the outer Flex above. */}
      <Container minWidth={0}>
        {containerProps => (
          <InfoText
            title={labelTooltip}
            ellipsis
            bold
            aria-current="location"
            {...containerProps}
          >
            {label}
          </InfoText>
        )}
      </Container>
      <BreadcrumbTrailingActions actions={trailingActions} />
    </Flex>
  );
}
