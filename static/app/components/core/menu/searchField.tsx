import styled from '@emotion/styled';
import {IconSearch} from '@sentry/icons/search';

import {InputGroup} from '@sentry/scraps/input';
import {Flex} from '@sentry/scraps/layout';

export type MenuSearchFieldProps = React.ComponentPropsWithRef<typeof InputGroup.Input>;

export function MenuSearchField(props: MenuSearchFieldProps) {
  return (
    <InputGroup>
      <InputGroup.LeadingItems disablePointerEvents>
        <Flex
          paddingLeft="2xs"
          align="center"
          justify="center"
          style={{transform: 'translateY(1px) translateX(1px)'}}
        >
          <IconSearch size="xs" variant="muted" />
        </Flex>
      </InputGroup.LeadingItems>
      <SearchInput size="xs" {...props} />
    </InputGroup>
  );
}

const SearchInput = styled(InputGroup.Input)`
  appearance: none;
  width: calc(100% - ${p => p.theme.space.xs} * 2);
  margin: ${p => p.theme.space.xs} ${p => p.theme.space.xs};

  [data-menu-has-header='true'] > * > & {
    margin-top: calc(${p => p.theme.space.xs} + 1px);
  }
`;
