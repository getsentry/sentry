import {IconCircle} from '@sentry/icons/circle';

import {Tag} from '@sentry/scraps/badge';
import {
  ListItem,
  ReserveLeadingSlot,
  SectionList,
  type ListItemProps,
} from '@sentry/scraps/menu';

const sizes: Array<NonNullable<ListItemProps['size']>> = ['xs', 'sm', 'md'];
const variants = ['plain', 'leading', 'details', 'leading-details'] as const;

describe('ListItem', () => {
  describe.each(sizes)('size %s', size => {
    it.snapshot.each([...variants])(
      '%s',
      variant => {
        const hasLeading = variant === 'leading' || variant === 'leading-details';
        const hasDetails = variant === 'details' || variant === 'leading-details';

        return (
          <SectionList padding="md" width="300px">
            <ListItem
              size={size}
              label="Option"
              leadingItems={hasLeading ? <IconCircle aria-hidden /> : undefined}
              details={hasDetails ? 'Additional information about the option' : undefined}
            />
          </SectionList>
        );
      },
      variant => ({
        tags: {
          area: 'core',
          size,
          leadingItems: String(variant === 'leading' || variant === 'leading-details'),
          details: String(variant === 'details' || variant === 'leading-details'),
        },
      })
    );

    it.snapshot(
      'rich-label',
      () => (
        <SectionList padding="md" width="300px">
          <ListItem
            size={size}
            label={
              <Tag variant="muted" icon={<IconCircle />}>
                Option
              </Tag>
            }
          />
        </SectionList>
      ),
      {tags: {area: 'core', size}}
    );

    it.snapshot(
      'section-gap',
      () => (
        <SectionList padding="md" width="300px">
          <ListItem size={size} label="First in section" />
          <ListItem size={size} label="Spaced from the item above" gapAbove />
          <ListItem size={size} label="Spaced from the item above" gapAbove />
        </SectionList>
      ),
      {tags: {area: 'core', size, gapAbove: 'true'}}
    );

    it.snapshot(
      'reserved-leading-slot',
      () => (
        <SectionList padding="md" width="300px">
          <ReserveLeadingSlot reserve>
            <ListItem
              size={size}
              label="With icon"
              leadingItems={<IconCircle aria-hidden />}
            />
            <ListItem size={size} label="Without icon" />
          </ReserveLeadingSlot>
        </SectionList>
      ),
      {tags: {area: 'core', size}}
    );
  });
});
