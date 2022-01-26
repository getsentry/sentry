import {
  mountWithTheme,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import Tooltip from 'sentry/components/tooltip';

describe('Tooltip', function () {
  it('renders', function () {
    const {container} = mountWithTheme(
      <Tooltip delay={0} title="test">
        <span>My Button</span>
      </Tooltip>
    );
    expect(container).toSnapshot();
  });

  it('updates title', async function () {
    const context = TestStubs.routerContext();
    const {rerender} = mountWithTheme(
      <Tooltip delay={0} title="test">
        <span>My Button</span>
      </Tooltip>,
      {context}
    );

    // Change title
    rerender(
      <Tooltip delay={0} title="bar">
        <span>My Button</span>
      </Tooltip>
    );

    userEvent.hover(screen.getByText('My Button'));
    expect(screen.getByText('bar')).toBeInTheDocument();

    userEvent.unhover(screen.getByText('My Button'));
    await waitForElementToBeRemoved(() => screen.queryByText('bar'));
  });

  it('disables and does not render', function () {
    mountWithTheme(
      <Tooltip delay={0} title="test" disabled>
        <span>My Button</span>
      </Tooltip>,
      {context: TestStubs.routerContext()}
    );

    userEvent.hover(screen.getByText('My Button'));

    expect(screen.queryByText('test')).not.toBeInTheDocument();

    userEvent.unhover(screen.getByText('My Button'));
  });

  it('does not render an empty tooltip', function () {
    mountWithTheme(
      <Tooltip delay={0} title="">
        <span>My Button</span>
      </Tooltip>,
      {context: TestStubs.routerContext()}
    );
    userEvent.hover(screen.getByText('My Button'));

    expect(screen.getByText('My Button')).not.toHaveAttribute('aria-describedby');

    userEvent.unhover(screen.getByText('My Button'));
  });
});
