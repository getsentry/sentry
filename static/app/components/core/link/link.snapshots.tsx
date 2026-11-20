import {ExternalLink, Link} from '@sentry/scraps/link';

describe('Link', () => {
  function Wrapper({children}: {children: React.ReactNode}) {
    // Padding prevents rootElement.screenshot() from clipping the focus ring.
    return <div style={{padding: 8}}>{children}</div>;
  }

  it.snapshot(
    'default',
    () => (
      <Wrapper>
        <Link to="/issues/">Link</Link>
      </Wrapper>
    ),
    {tags: {area: 'core'}}
  );

  it.snapshot(
    'hover',
    () => (
      <Wrapper>
        <Link to="/issues/">Link</Link>
      </Wrapper>
    ),
    {tags: {state: 'hover', area: 'core'}, interaction: {hover: 'a'}}
  );

  it.snapshot(
    'disabled',
    () => (
      <Wrapper>
        <Link to="/issues/" disabled>
          Link
        </Link>
      </Wrapper>
    ),
    {tags: {disabled: 'true', area: 'core'}}
  );

  it.snapshot(
    'external',
    () => (
      <Wrapper>
        <ExternalLink href="https://example.com/">External link</ExternalLink>
      </Wrapper>
    ),
    {tags: {external: 'true', area: 'core'}}
  );
});
