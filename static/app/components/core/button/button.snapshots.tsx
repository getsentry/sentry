import {Button} from '@sentry/scraps/button';

// Buttons need a bit of padding as rootElement.screenshot() clips to the element's CSS border-box.
// For buttons, box-shadows/outlines/focus rings extending outside #root get cut off.
function Wrapper({children}: {children: React.ReactNode}) {
  return <div style={{padding: 8}}>{children}</div>;
}

describe('Button', () => {
  it.snapshot('Default', () => (
    <Wrapper>
      <Button>Default</Button>
    </Wrapper>
  ));

  it.snapshot('Primary', () => (
    <Wrapper>
      <Button priority="primary">Primary</Button>
    </Wrapper>
  ));

  it.snapshot(
    'Primary (dark)',
    () => (
      <Wrapper>
        <Button priority="primary">Primary</Button>
      </Wrapper>
    ),
    {theme: 'dark'}
  );

  it.snapshot('Danger', () => (
    <Wrapper>
      <Button priority="danger">Danger</Button>
    </Wrapper>
  ));
});
