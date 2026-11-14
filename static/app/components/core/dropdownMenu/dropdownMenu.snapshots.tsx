import {IconEllipsis} from '@sentry/icons/ellipsis';

import {ButtonBar} from '@sentry/scraps/button';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {SizeProvider} from '@sentry/scraps/sizeContext';

describe('DropdownMenu', () => {
  it.snapshot.each(['xs', 'sm', 'md'] as const)(
    'custom triggers with inherited size %s',
    size => (
      <SizeProvider size={size}>
        <Flex align="center" gap="md" padding="md">
          <DropdownMenu
            items={[{key: 'duplicate', label: 'Duplicate query'}]}
            trigger={props => (
              <OverlayTrigger.Button {...props}>Query actions</OverlayTrigger.Button>
            )}
          />
          <ButtonBar size="xs">
            <DropdownMenu
              items={[{key: 'duplicate', label: 'Duplicate query'}]}
              trigger={props => (
                <OverlayTrigger.IconButton
                  {...props}
                  icon={<IconEllipsis />}
                  aria-label="More actions"
                />
              )}
            />
          </ButtonBar>
        </Flex>
      </SizeProvider>
    ),
    size => ({tags: {area: 'core', size, trigger: 'custom'}})
  );

  it.snapshot(
    'custom trigger with explicit menu size xs inside size sm',
    () => (
      <SizeProvider size="sm">
        <Flex padding="md">
          <DropdownMenu
            size="xs"
            items={[{key: 'duplicate', label: 'Duplicate query'}]}
            trigger={props => (
              <OverlayTrigger.Button {...props}>Query actions</OverlayTrigger.Button>
            )}
          />
        </Flex>
      </SizeProvider>
    ),
    {tags: {area: 'core', size: 'xs', contextSize: 'sm', trigger: 'custom'}}
  );

  it.snapshot(
    'default trigger with omitted menu size inside size sm',
    () => (
      <SizeProvider size="sm">
        <Flex padding="md">
          <DropdownMenu
            items={[{key: 'duplicate', label: 'Duplicate query'}]}
            triggerLabel="Query actions"
          />
        </Flex>
      </SizeProvider>
    ),
    {tags: {area: 'core', size: 'md', contextSize: 'sm', trigger: 'default'}}
  );
});
