import {IconCircle} from '@sentry/icons/circle';

import {MenuListItem, type MenuListItemProps} from '@sentry/scraps/menuListItem';

const sizes: Array<NonNullable<MenuListItemProps['size']>> = ['xs', 'sm', 'md'];
const variants = ['plain', 'leading', 'details', 'leading-details'] as const;

describe('MenuListItem', () => {
  describe.each(sizes)('size %s', size => {
    it.snapshot.each([...variants])(
      '%s',
      variant => {
        const hasLeading = variant === 'leading' || variant === 'leading-details';
        const hasDetails = variant === 'details' || variant === 'leading-details';

        return (
          <ul style={{padding: 8, width: 300, listStyle: 'none'}}>
            <MenuListItem
              size={size}
              label="Option"
              leadingItems={hasLeading ? <IconCircle aria-hidden /> : undefined}
              details={hasDetails ? 'Additional information about the option' : undefined}
            />
          </ul>
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
  });
});
