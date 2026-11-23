import {IconSearch} from '@sentry/icons/search';

import {Container} from '@sentry/scraps/layout';

export function ScmSearchIcon() {
  return (
    <Container paddingLeft="lg" flexShrink={0}>
      <IconSearch size="sm" variant="muted" aria-hidden />
    </Container>
  );
}
