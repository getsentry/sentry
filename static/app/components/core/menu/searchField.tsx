import {IconSearch} from '@sentry/icons/search';

import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex} from '@sentry/scraps/layout';

export type MenuSearchFieldProps = React.ComponentPropsWithRef<typeof InputGroup.Input>;

export function MenuSearchField(props: MenuSearchFieldProps) {
  return (
    <Container padding="xs">
      <InputGroup>
        <InputGroup.LeadingItems disablePointerEvents>
          <Flex paddingLeft="2xs" align="center" justify="center">
            <IconSearch size="xs" variant="muted" />
          </Flex>
        </InputGroup.LeadingItems>
        <InputGroup.Input size="xs" {...props} />
      </InputGroup>
    </Container>
  );
}
