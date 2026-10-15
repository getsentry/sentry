import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

interface EventDataSectionProps {
  children: React.ReactNode;
  /**
   * The title of the section
   */
  title: React.ReactNode;
  /**
   * Used as the `id` of the section for hash navigation.
   */
  type: string;
  /**
   * Actions that appear to the far right of the title
   */
  actions?: React.ReactNode;
  className?: string;
  ref?: React.Ref<HTMLDivElement>;
}

function scrollToSection(element: HTMLDivElement) {
  if (window.location.hash && element) {
    const [, hash] = window.location.hash.split('#');

    try {
      const anchorElement = hash && element.querySelector('div#' + hash);
      if (anchorElement) {
        anchorElement.scrollIntoView();
      }
    } catch {
      // Since we're blindly taking the hash from the url and shoving
      // it into a querySelector, it's possible that this may
      // raise an exception if the input is invalid. So let's just ignore
      // this instead of blowing up.
      // e.g. `document.querySelector('div#=')`
      // > Uncaught DOMException: Failed to execute 'querySelector' on 'Document': 'div#=' is not a valid selector.
    }
  }
}

export function EventDataSection({
  children,
  className,
  type,
  title,
  actions,
  ...props
}: EventDataSectionProps) {
  return (
    <Stack gap="md" ref={scrollToSection} className={className} {...props}>
      <Flex id={type} align="center" gap="xs" wrap="wrap">
        {title && (
          <Container flexGrow={1} padding="sm 0">
            <Heading as="h3" size="lg" variant="primary">
              {title}
            </Heading>
          </Container>
        )}
        {actions && (
          <Container flexShrink={0} maxWidth="100%">
            {actions}
          </Container>
        )}
      </Flex>
      <Container position="relative">{children}</Container>
    </Stack>
  );
}
