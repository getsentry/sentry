import {IconSearch} from '@sentry/icons/search';

import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex} from '@sentry/scraps/layout';

export type SearchInputProps = React.ComponentPropsWithRef<typeof InputGroup.Input> & {
  containerPadding?: React.ComponentProps<typeof Container>['padding'];
};

export function SearchInput({containerPadding = 'xs', ...props}: SearchInputProps) {
  return (
    <Container padding={containerPadding}>
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
