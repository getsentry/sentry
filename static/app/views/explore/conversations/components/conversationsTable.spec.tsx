import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {InputOutputTooltipCell} from 'sentry/views/explore/conversations/components/conversationsTable';

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

describe('InputOutputTooltipCell', () => {
  afterEach(() => {
    // @ts-expect-error cleanup previously mocked properties
    delete HTMLElement.prototype.scrollWidth;
    // @ts-expect-error cleanup previously mocked properties
    delete HTMLElement.prototype.clientWidth;
  });

  it('does not show the tooltip when the cell content fits', async () => {
    mockOverflow(80, 120);

    render(
      <InputOutputTooltipCell text={'Conversation preview\n\n```js\ntooltip only\n```'} />
    );

    await userEvent.hover(screen.getByText('Conversation preview'));

    expect(screen.queryByText('tooltip only')).not.toBeInTheDocument();
  });

  it('shows the tooltip when the cell content overflows', async () => {
    mockOverflow(180, 100);

    render(
      <InputOutputTooltipCell text={'Conversation preview\n\n```js\ntooltip only\n```'} />
    );

    await userEvent.hover(screen.getByText('Conversation preview'));

    await waitFor(() => {
      expect(screen.getByText('tooltip only')).toBeInTheDocument();
    });
  });
});
