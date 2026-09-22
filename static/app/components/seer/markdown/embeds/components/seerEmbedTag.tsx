import type {ReactNode} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Text} from '@sentry/scraps/text';

import type {TagVariant} from 'sentry/utils/theme';

/**
 * A `Tag` for `SeerEmbedBlock`'s badge slot, whose label sits on the same
 * baseline as the header's title and its "View ..." link.
 *
 * The `Text` wrapper is load-bearing rather than decorative. `Tag` renders a
 * bare label whose box keeps the font's half-leading, and the pill centers that
 * box; the title and link beside it come from `Heading` and `Link`, which set
 * `text-box-trim: trim-both` so their boxes hug the glyphs instead. Centering
 * the two kinds of box against each other left the tag's label ~1.4px high.
 * `Text` gives the label the same trimmed box as its neighbours.
 *
 * `variant="inherit"` keeps the pill's own text color -- `Text` would otherwise
 * paint the label with the primary content color and drop the tag's.
 */
export function SeerEmbedTag({
  children,
  variant = 'muted',
}: {
  children: ReactNode;
  variant?: TagVariant;
}) {
  return (
    <Tag variant={variant}>
      <Text ellipsis variant="inherit">
        {children}
      </Text>
    </Tag>
  );
}
