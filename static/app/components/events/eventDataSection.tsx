import {css} from '@emotion/react';

import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading} from '@sentry/scraps/text';

import {IconLink} from 'sentry/icons';

interface EventDataSectionProps {
  children: React.ReactNode;
  /**
   * The title of the section
   */
  title: React.ReactNode;
  /**
   * Used as the `id` of the section. This powers the permalink
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
  const titleNode = (
    <Container padding="sm 0">
      <Heading as="h3" size="md" variant="secondary">
        {title}
      </Heading>
    </Container>
  );

  return (
    <Stack
      gap="md"
      ref={scrollToSection}
      className={className}
      padding={{zero: 'md xl', '3xl': 'lg 3xl'}}
      {...props}
    >
      <Flex
        id={type}
        data-test-id={`event-section-${type}`}
        align="center"
        gap="xs"
        wrap="wrap"
        css={theme => css`
          & h3 a {
            color: ${theme.tokens.content.secondary};
            font-size: ${theme.font.size.md};
            font-weight: ${theme.font.weight.sans.medium};
          }

          & small {
            color: ${theme.tokens.content.primary};
            font-size: ${theme.font.size.md};
            margin-right: ${theme.space.xs};
            margin-left: ${theme.space.xs};
          }
          & small > span {
            color: ${theme.tokens.content.primary};
            font-weight: ${theme.font.weight.sans.regular};
          }

          @container (min-width: ${theme.container['5xl']}) {
            & > small {
              margin-left: ${theme.space.md};
              display: inline-block;
            }
          }

          > *:first-child {
            position: relative;
            flex-grow: 1;
          }
        `}
      >
        {title && (
          <Grid columns="max-content 1fr" align="center" gap="xs">
            <Container as="span" width="100%" position="relative" className="permalink">
              <Flex
                position="absolute"
                top="0"
                left="0"
                height="100%"
                paddingLeft="xs"
                align="center"
              >
                {linkProps => (
                  <ExternalLink
                    {...linkProps}
                    href={`#${type}`}
                    openInNewTab={false}
                    css={theme => css`
                      width: calc(100% + ${theme.space['2xl']});
                      transform: translateX(-${theme.space['2xl']});

                      .permalink-icon {
                        opacity: 0;
                        transform: translateY(-1px);
                        transition: opacity 100ms;
                      }

                      :hover .permalink-icon,
                      :focus .permalink-icon {
                        opacity: 1;
                      }
                    `}
                  >
                    <IconLink size="xs" variant="muted" className="permalink-icon" />
                  </ExternalLink>
                )}
              </Flex>
              {titleNode}
            </Container>
          </Grid>
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
