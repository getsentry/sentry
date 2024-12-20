import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {Tooltip} from 'sentry/components/tooltip';

describe('Tooltip', function () {
  function mockOverflow(width: number, containerWidth: number) {
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      value: width,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      value: containerWidth,
    });
  }

  afterEach(() => {
    // @ts-expect-error
    delete HTMLElement.prototype.scrollWidth;
    // @ts-expect-error
    delete HTMLElement.prototype.clientWidth;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders', async function () {
    render(
      <Tooltip delay={0} title="test">
        <span>My Button</span>
      </Tooltip>
    );

    await userEvent.hover(screen.getByText('My Button'));
    expect(screen.getByText('test')).toBeInTheDocument();

    // Check that the arrow svg is rendered
    expect(document.querySelector('svg')).toBeInTheDocument();

    await userEvent.unhover(screen.getByText('My Button'));
    await waitFor(() => {
      expect(screen.queryByText('test')).not.toBeInTheDocument();
    });
  });

  it('updates title', async function () {
    const {rerender} = render(
      <Tooltip delay={0} title="test">
        <span>My Button</span>
      </Tooltip>
    );

    // Change title
    rerender(
      <Tooltip delay={0} title="bar">
        <span>My Button</span>
      </Tooltip>
    );

    await userEvent.hover(screen.getByText('My Button'));
    expect(screen.getByText('bar')).toBeInTheDocument();

    await userEvent.unhover(screen.getByText('My Button'));
    await waitFor(() => {
      expect(screen.queryByText('bar')).not.toBeInTheDocument();
    });
  });

  it('disables and does not render', async function () {
    render(
      <Tooltip delay={0} title="test" disabled>
        <span>My Button</span>
      </Tooltip>
    );

    await userEvent.hover(screen.getByText('My Button'));

    expect(screen.queryByText('test')).not.toBeInTheDocument();

    await userEvent.unhover(screen.getByText('My Button'));
  });

  it('resets visibility when becoming disabled', async function () {
    const {rerender} = render(
      <Tooltip delay={0} title="test" disabled={false}>
        <span>My Button</span>
      </Tooltip>
    );

    await userEvent.hover(screen.getByText('My Button'));
    expect(screen.getByText('test')).toBeInTheDocument();

    rerender(
      <Tooltip delay={0} title="test" disabled>
        <span>My Button</span>
      </Tooltip>
    );
    expect(screen.queryByText('test')).not.toBeInTheDocument();

    // Becomes enabled again
    rerender(
      <Tooltip delay={0} title="test" disabled={false}>
        <span>My Button</span>
      </Tooltip>
    );
    expect(screen.queryByText('test')).not.toBeInTheDocument();
  });

  it('does not render an empty tooltip', async function () {
    render(
      <Tooltip delay={0} title="">
        <span>My Button</span>
      </Tooltip>
    );
    await userEvent.hover(screen.getByText('My Button'));

    expect(screen.getByText('My Button')).not.toHaveAttribute('aria-describedby');

    await userEvent.unhover(screen.getByText('My Button'));
  });

  it('displays a tooltip if the content overflows with showOnlyOnOverflow', async function () {
    // Mock this to return true because scrollWidth and clientWidth are 0 in JSDOM
    mockOverflow(100, 50);

    render(
      <Tooltip delay={0} title="test" showOnlyOnOverflow>
        <div>This text overflows</div>
      </Tooltip>
    );

    await userEvent.hover(screen.getByText('This text overflows'));

    expect(screen.getByText('test')).toBeInTheDocument();

    await userEvent.unhover(screen.getByText('This text overflows'));
  });

  it('does not display a tooltip if the content does not overflow with showOnlyOnOverflow', async function () {
    mockOverflow(50, 100);

    render(
      <Tooltip delay={0} title="test" showOnlyOnOverflow>
        <div>This text does not overflow</div>
      </Tooltip>
    );

    await userEvent.hover(screen.getByText('This text does not overflow'));

    expect(screen.queryByText('test')).not.toBeInTheDocument();
  });
});
