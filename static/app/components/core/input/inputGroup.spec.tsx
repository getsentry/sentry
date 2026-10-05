import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {triggerResizeObservers} from 'sentry-test/resizeObserver';

import {Button} from '@sentry/scraps/button';
import {InputGroup} from '@sentry/scraps/input';

describe('InputGroup', () => {
  it('renders input', () => {
    render(
      <InputGroup>
        <InputGroup.Input value="Search" onChange={() => {}} />
      </InputGroup>
    );

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveDisplayValue('Search');
  });

  it('renders disabled input', () => {
    render(
      <InputGroup>
        <InputGroup.Input disabled />
      </InputGroup>
    );

    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('renders leading elements', async () => {
    render(
      <InputGroup>
        <InputGroup.LeadingItems>
          <Button>Leading Button</Button>
        </InputGroup.LeadingItems>
        <InputGroup.Input />
      </InputGroup>
    );

    // Leading button is rendered
    expect(screen.getByTestId('input-leading-items')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Leading Button'})).toBeInTheDocument();

    // Focus moves first to leading button and then to input
    await userEvent.tab();
    expect(screen.getByRole('button', {name: 'Leading Button'})).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('renders trailing elements', async () => {
    render(
      <InputGroup>
        <InputGroup.Input />
        <InputGroup.TrailingItems>
          <Button>Trailing Button</Button>
        </InputGroup.TrailingItems>
      </InputGroup>
    );

    // Trailing button is rendered
    expect(screen.getByTestId('input-trailing-items')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Trailing Button'})).toBeInTheDocument();

    // Focus moves first to input and then to trailing button
    await userEvent.tab();
    expect(screen.getByRole('textbox')).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', {name: 'Trailing Button'})).toHaveFocus();
  });

  it.each(['leading', 'trailing'] as const)(
    'remeasures %s items and clears padding after removal',
    side => {
      const offsetWidthSpy = jest
        .spyOn(HTMLElement.prototype, 'offsetWidth', 'get')
        .mockReturnValue(24);
      const Items =
        side === 'leading' ? InputGroup.LeadingItems : InputGroup.TrailingItems;
      try {
        const {rerender} = render(
          <InputGroup>
            <Items>
              <Button>Action</Button>
            </Items>
            <InputGroup.Input />
          </InputGroup>
        );
        const group = screen.getByRole('textbox').parentElement!;
        expect(group.style.getPropertyValue(`--input-${side}-width`)).toBe('24px');
        offsetWidthSpy.mockReturnValue(48);
        act(() => triggerResizeObservers());
        expect(group.style.getPropertyValue(`--input-${side}-width`)).toBe('48px');
        rerender(
          <InputGroup>
            <InputGroup.Input />
          </InputGroup>
        );
        expect(group.style.getPropertyValue(`--input-${side}-width`)).toBe('');
      } finally {
        offsetWidthSpy.mockRestore();
      }
    }
  );

  it('does not remeasure items when their parent rerenders', () => {
    const offsetWidthSpy = jest
      .spyOn(HTMLElement.prototype, 'offsetWidth', 'get')
      .mockReturnValue(24);

    const renderGroup = (label: string) => (
      <InputGroup>
        <InputGroup.LeadingItems>
          <Button>{label}</Button>
        </InputGroup.LeadingItems>
        <InputGroup.Input />
      </InputGroup>
    );

    try {
      const {rerender} = render(renderGroup('initial'));
      expect(offsetWidthSpy).toHaveBeenCalledTimes(1);

      rerender(renderGroup('updated'));
      expect(offsetWidthSpy).toHaveBeenCalledTimes(1);
    } finally {
      offsetWidthSpy.mockRestore();
    }
  });
});
