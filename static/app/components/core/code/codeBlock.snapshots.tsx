import {CodeBlock} from '@sentry/scraps/codeBlock';
import {Container} from '@sentry/scraps/layout';

// The app snapshot harness covers published Scraps components.
describe('CodeBlock wrapping', () => {
  it.snapshot.each(['scroll', 'wrap'] as const)(
    '%s',
    wrapMode => (
      <Container width="320px" padding="md">
        <CodeBlock language="markdown" wrapMode={wrapMode} hideCopyButton>
          {
            'This paragraph should fit within the available width when wrapping is enabled.\n\nhttps://example.com/a/long/path/that/should/also/wrap/within/the/container'
          }
        </CodeBlock>
      </Container>
    ),
    wrapMode => ({tags: {wrapMode, area: 'core'}})
  );
});
