import {IconSearch} from '@sentry/icons/search';

import {InputGroup} from '@sentry/scraps/input';
import {Flex} from '@sentry/scraps/layout';

export type SearchInputProps = React.ComponentPropsWithRef<typeof InputGroup.Input>;

/** Shared search field with a leading icon for menu controls. */
export function SearchInput(props: SearchInputProps) {
  return (
    <InputGroup>
      <InputGroup.LeadingItems disablePointerEvents>
        <Flex paddingLeft="2xs" align="center" justify="center">
          <IconSearch size="xs" variant="muted" />
        </Flex>
      </InputGroup.LeadingItems>
      <InputGroup.Input size="xs" {...props} />
    </InputGroup>
  );
}
