import {IconSearch} from '@sentry/icons/search';

import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex} from '@sentry/scraps/layout';

type SearchInputProps = React.ComponentPropsWithRef<typeof InputGroup.Input>;

export interface MenuSearchFieldProps extends Omit<SearchInputProps, 'onChange'> {
  onChange: (value: string) => void;
}

/** Controlled search input for a menu header. Its host owns filtering. */
export function MenuSearchField({onChange, ...props}: MenuSearchFieldProps) {
  return (
    <Container padding="xs">
      <InputGroup>
        <InputGroup.LeadingItems disablePointerEvents>
          <Flex paddingLeft="2xs" align="center" justify="center">
            <IconSearch size="xs" variant="muted" />
          </Flex>
        </InputGroup.LeadingItems>
        <InputGroup.Input
          size="xs"
          {...props}
          onChange={event => onChange(event.target.value)}
        />
      </InputGroup>
    </Container>
  );
}
