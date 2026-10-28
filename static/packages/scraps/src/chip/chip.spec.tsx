import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';

import {Chip} from '@sentry/scraps/chip';
import {lightTheme} from '@sentry/scraps/theme';
import {TranslationContextProvider} from '@sentry/scraps/translation';

const translate = jest.fn((template: string, ...args: unknown[]) =>
  template.replace('%s', String(args[0]))
);

describe('Chip', () => {
  describe('flat API', () => {
    it('renders property, operator, and value', () => {
      render(<Chip property="browser" operator="is" value="Chrome" />, {
        wrapper: ThemeWrapper,
      });
      expect(screen.getByText('browser')).toBeInTheDocument();
      expect(screen.getByText('is')).toBeInTheDocument();
      expect(screen.getByText('Chrome')).toBeInTheDocument();
    });

    it('omits the operator when not provided', () => {
      render(<Chip property="browser" value="Chrome" />, {wrapper: ThemeWrapper});
      expect(screen.getByText('browser')).toBeInTheDocument();
      expect(screen.getByText('Chrome')).toBeInTheDocument();
      expect(screen.queryByText('is')).not.toBeInTheDocument();
    });

    it('renders only the value when property is omitted', () => {
      render(<Chip value="Chrome" />, {wrapper: ThemeWrapper});
      expect(screen.getByText('Chrome')).toBeInTheDocument();
      expect(screen.queryByText('browser')).not.toBeInTheDocument();
    });

    it('is not interactive by default', () => {
      render(<Chip property="browser" operator="is" value="Chrome" />, {
        wrapper: ThemeWrapper,
      });
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders a dismiss button and fires onDismiss', async () => {
      const onDismiss = jest.fn();
      render(<Chip property="browser" value="Chrome" onDismiss={onDismiss} />, {
        wrapper: ThemeWrapper,
      });
      expect(translate).toHaveBeenCalledWith('Remove %s', 'browser Chrome');
      await userEvent.click(screen.getByRole('button', {name: 'Remove browser Chrome'}));
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('does not render a dismiss button when readonly', () => {
      render(
        // readonly chips cannot be dismissed — the union rejects onDismiss at
        // compile time; assert the runtime guard suppresses it as well.
        // @ts-expect-error onDismiss is not allowed alongside readonly
        <Chip readonly property="browser" value="Chrome" onDismiss={() => {}} />,
        {wrapper: ThemeWrapper}
      );
      expect(
        screen.queryByRole('button', {name: 'Remove browser Chrome'})
      ).not.toBeInTheDocument();
    });
  });

  describe('compound API', () => {
    it('renders sections as inert text by default', () => {
      render(
        <Chip.Root>
          <Chip.Property>browser</Chip.Property>
          <Chip.Operator>is</Chip.Operator>
          <Chip.Value>Chrome</Chip.Value>
        </Chip.Root>,
        {wrapper: ThemeWrapper}
      );
      expect(screen.getByText('browser')).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders a section as a button when given onClick and fires it', async () => {
      const editValue = jest.fn();
      render(
        <Chip.Root>
          <Chip.Property>browser</Chip.Property>
          <Chip.Value onClick={editValue}>Chrome</Chip.Value>
        </Chip.Root>,
        {wrapper: ThemeWrapper}
      );

      // Property stays inert, value becomes a button.
      expect(screen.queryByRole('button', {name: 'browser'})).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', {name: 'Chrome'}));
      expect(editValue).toHaveBeenCalledTimes(1);
    });

    it('keeps dismiss clicks from bubbling to the chip', async () => {
      const onChipClick = jest.fn();
      const onDismiss = jest.fn();
      render(
        <Chip.Root onClick={onChipClick}>
          <Chip.Value>Chrome</Chip.Value>
          <Chip.Dismiss onClick={onDismiss} />
        </Chip.Root>,
        {wrapper: ThemeWrapper}
      );

      await userEvent.click(screen.getByRole('button', {name: 'Remove'}));
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(onChipClick).not.toHaveBeenCalled();
    });

    it('renders interactive sections as inert when the root is readonly', () => {
      render(
        <Chip.Root readonly>
          <Chip.Value onClick={() => {}}>Chrome</Chip.Value>
          <Chip.Dismiss onClick={() => {}} />
        </Chip.Root>,
        {wrapper: ThemeWrapper}
      );
      expect(screen.getByText('Chrome')).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('roving focus', () => {
    function InteractiveChip() {
      return (
        <Chip.Root>
          <Chip.Property onClick={() => {}}>browser</Chip.Property>
          <Chip.Operator onClick={() => {}}>is</Chip.Operator>
          <Chip.Value onClick={() => {}}>Chrome</Chip.Value>
          <Chip.Dismiss onClick={() => {}} />
        </Chip.Root>
      );
    }

    it('exposes a single tab stop', () => {
      render(<InteractiveChip />, {wrapper: ThemeWrapper});
      expect(screen.getByRole('button', {name: 'browser'})).toHaveAttribute(
        'tabindex',
        '0'
      );
      expect(screen.getByRole('button', {name: 'is'})).toHaveAttribute('tabindex', '-1');
      expect(screen.getByRole('button', {name: 'Chrome'})).toHaveAttribute(
        'tabindex',
        '-1'
      );
      expect(screen.getByRole('button', {name: 'Remove'})).toHaveAttribute(
        'tabindex',
        '-1'
      );
    });

    it('moves focus between sections with the arrow keys', async () => {
      render(<InteractiveChip />, {wrapper: ThemeWrapper});

      await userEvent.tab();
      expect(screen.getByRole('button', {name: 'browser'})).toHaveFocus();

      await userEvent.keyboard('{ArrowRight}');
      expect(screen.getByRole('button', {name: 'is'})).toHaveFocus();

      await userEvent.keyboard('{End}');
      expect(screen.getByRole('button', {name: 'Remove'})).toHaveFocus();

      await userEvent.keyboard('{Home}');
      expect(screen.getByRole('button', {name: 'browser'})).toHaveFocus();

      await userEvent.keyboard('{ArrowLeft}');
      expect(screen.getByRole('button', {name: 'Remove'})).toHaveFocus();
    });

    it('moves the tab stop to follow the focused section', async () => {
      render(<InteractiveChip />, {wrapper: ThemeWrapper});

      await userEvent.tab();
      await userEvent.keyboard('{ArrowRight}');

      // The single tab stop follows focus rather than snapping back to the first
      // section, so tabbing away and back returns to where the user left off.
      expect(screen.getByRole('button', {name: 'browser'})).toHaveAttribute(
        'tabindex',
        '-1'
      );
      expect(screen.getByRole('button', {name: 'is'})).toHaveAttribute('tabindex', '0');
    });

    it('keeps the managed tab stop authoritative over a caller tabIndex', () => {
      render(
        <Chip.Root>
          <Chip.Property onClick={() => {}} tabIndex={5}>
            browser
          </Chip.Property>
          <Chip.Value onClick={() => {}}>Chrome</Chip.Value>
        </Chip.Root>,
        {wrapper: ThemeWrapper}
      );
      // A caller tabIndex must not override roving management in auto mode.
      expect(screen.getByRole('button', {name: 'browser'})).toHaveAttribute(
        'tabindex',
        '0'
      );
      expect(screen.getByRole('button', {name: 'Chrome'})).toHaveAttribute(
        'tabindex',
        '-1'
      );
    });
  });
});

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return (
    <ThemeProvider theme={lightTheme}>
      <TranslationContextProvider
        value={{
          t: translate,
          tct: template => template,
        }}
      >
        {children}
      </TranslationContextProvider>
    </ThemeProvider>
  );
}
