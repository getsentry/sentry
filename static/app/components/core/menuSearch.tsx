import styled from '@emotion/styled';
import {IconSearch} from '@sentry/icons/search';

import {InputGroup} from '@sentry/scraps/input';
import {Flex} from '@sentry/scraps/layout';

type Props = React.ComponentProps<typeof InputGroup.Input> & {
  showIcon?: boolean;
};

/** Search field shared by selection menus and action menus. */
export function MenuSearch({showIcon = true, ...inputProps}: Props) {
  return (
    <InputGroup>
      {showIcon && (
        <InputGroup.LeadingItems disablePointerEvents>
          <Flex paddingLeft="2xs" align="center" justify="center">
            <IconSearch size="xs" variant="muted" />
          </Flex>
        </InputGroup.LeadingItems>
      )}
      <SearchInput size="xs" {...inputProps} />
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
