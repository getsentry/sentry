import {
  mountWithTheme,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import Tooltip from 'sentry/components/tooltip';
import * as utils from 'sentry/utils/tooltip';

describe('Tooltip', function () {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  it('displays a tooltip if the content overflows with showOnOverflow', async function () {
    jest.spyOn(utils, 'isOverflown').mockReturnValue(true);
    mountWithTheme(
      <Tooltip delay={0} title="test" showOnOverflow>
        <div>This text overflows</div>
      </Tooltip>,
      {context: TestStubs.routerContext()}
    );

    userEvent.hover(screen.getByText('This text overflows'));

    expect(screen.getByText('test')).toBeInTheDocument();

    userEvent.unhover(screen.getByText('This text overflows'));
  });

  it('does not display a tooltip if the content does not overflow with showOnOverflow', function () {
    jest.spyOn(utils, 'isOverflown').mockReturnValue(false);
    mountWithTheme(
      <Tooltip title="Tooltip title" showOnOverflow>
        <div data-test-id="truncated-text">This text does not overflow</div>
      </Tooltip>,
      {context: TestStubs.routerContext()}
    );

    userEvent.hover(screen.getByText('This text does not overflow'));

    expect(screen.queryByText('Tooltip title')).not.toBeInTheDocument();
  });
});
