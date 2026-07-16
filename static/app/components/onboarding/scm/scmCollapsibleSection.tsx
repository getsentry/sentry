import {useId, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ScmCollapsibleReveal} from 'sentry/components/onboarding/scm/scmCollapsibleReveal';
import {IconChevron} from 'sentry/icons';

interface ScmCollapsibleSectionProps {
  children: React.ReactNode;
  title: React.ReactNode;
  /**
   * Whether the section starts expanded. Defaults to true.
   */
  defaultExpanded?: boolean;
  /**
   * Rendered at the far right of the title row (e.g. a helper label). Stays in
   * the header whether or not the section is expanded.
   */
  trailing?: React.ReactNode;
}

/**
 * A collapsible section for the SCM project-creation flow: a chevron and the
 * title share one transparent toggle button (mirroring the core Disclosure
 * look) with an optional trailing slot pinned right, and the body animates its
 * own height so sibling cards in a framer-motion `layout="position"` group
 * follow via normal document flow. `initial={false}` keeps it from animating on
 * mount, so it renders in its `defaultExpanded` state.
 *
 * This is a local variant of the core Disclosure rather than a consumer of it:
 * Disclosure.Content hides with `display: none`, which can't tween and won't
 * reflow sibling cards, and Disclosure.Title's full-width stretched button
 * can't express a content-hugging toggle without forking the shared component.
 */
export function ScmCollapsibleSection({
  title,
  trailing,
  defaultExpanded = true,
  children,
}: ScmCollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const contentId = useId();

  return (
    <Stack gap="0" width="100%">
      <Flex justify="between" align="center" width="100%" gap="md">
        <ToggleButton
          variant="transparent"
          size="md"
          icon={<IconChevron direction={expanded ? 'down' : 'right'} />}
          aria-expanded={expanded}
          // Only reference the content while it is in the DOM: the body is
          // conditionally rendered, so a static aria-controls would point at a
          // missing IDREF when collapsed.
          aria-controls={expanded ? contentId : undefined}
          onClick={() => setExpanded(value => !value)}
        >
          <Text as="span" bold>
            {title}
          </Text>
        </ToggleButton>
        {trailing}
      </Flex>
      <ScmCollapsibleReveal open={expanded} id={contentId}>
        <Content width="100%">{children}</Content>
      </ScmCollapsibleReveal>
    </Stack>
  );
}

// Mirrors core Disclosure's StretchedButton: a transparent toggle holding the
// chevron + title that hugs its content, with the left padding pulled in so the
// chevron sits near-flush with the section edge.
const ToggleButton = styled(Button)`
  padding-left: ${p => p.theme.space.xs};
`;

// Indents the body so its left edge lines up with the title copy inside
// ToggleButton: button padding-left (xs) + chevron width (md button -> sm icon,
// 14px) + the button's icon gap (md). Matches core Disclosure's 26px inset.
// padding-top lives here (not as a Stack gap) so the spacing collapses with the
// height animation instead of leaving a gap behind the title.
const Content = styled(Stack)`
  padding-top: ${p => p.theme.space.md};
  padding-left: calc(${p => p.theme.space.xs} + 14px + ${p => p.theme.space.md});
`;
