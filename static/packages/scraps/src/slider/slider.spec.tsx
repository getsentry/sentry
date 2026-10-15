import {useState} from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {lightTheme} from '@sentry/scraps/theme';

import {Slider} from './index';

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

function ControlledSlider(
  props: Omit<React.ComponentProps<typeof Slider>, 'value' | 'onChange'> & {
    initialValue?: number;
  }
) {
  const {initialValue = 50, ...rest} = props;
  const [value, setValue] = useState(initialValue);
  return <Slider {...rest} value={value} onChange={setValue} />;
}

describe('Slider', () => {
  describe('rendering', () => {
    it('renders with default value (uncontrolled)', () => {
      render(<Slider defaultValue={50} aria-label="Test" />, {wrapper: ThemeWrapper});
      expect(screen.getByRole('slider')).toHaveValue('50');
    });

    it('renders with controlled value', () => {
      render(<ControlledSlider initialValue={75} aria-label="Test" />, {
        wrapper: ThemeWrapper,
      });
      expect(screen.getByRole('slider')).toHaveValue('75');
    });

    it('applies aria-label', () => {
      render(<Slider defaultValue={50} aria-label="Volume" />, {wrapper: ThemeWrapper});
      expect(screen.getByRole('slider')).toHaveAccessibleName('Volume');
    });

    it('sets min/max/step attributes on the input', () => {
      render(<Slider defaultValue={50} min={10} max={90} step={5} aria-label="Test" />, {
        wrapper: ThemeWrapper,
      });
      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('min', '10');
      expect(slider).toHaveAttribute('max', '90');
      expect(slider).toHaveAttribute('step', '5');
    });

    it('sets aria-valuetext', () => {
      render(<Slider defaultValue={30} aria-label="Test" />, {wrapper: ThemeWrapper});
      expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '30');
    });
  });

  describe('disabled', () => {
    it('disables the slider', () => {
      render(<Slider disabled defaultValue={50} aria-label="Test" />, {
        wrapper: ThemeWrapper,
      });
      expect(screen.getByRole('slider')).toBeDisabled();
    });
  });

  describe('keyboard interaction', () => {
    it('increases value with ArrowRight', async () => {
      render(<ControlledSlider initialValue={50} aria-label="Test" />, {
        wrapper: ThemeWrapper,
      });
      const slider = screen.getByRole('slider');
      await userEvent.tab();
      expect(slider).toHaveFocus();
      await userEvent.keyboard('{ArrowRight}');
      expect(slider).toHaveValue('51');
    });

    it('decreases value with ArrowLeft', async () => {
      render(<ControlledSlider initialValue={50} aria-label="Test" />, {
        wrapper: ThemeWrapper,
      });
      await userEvent.tab();
      await userEvent.keyboard('{ArrowLeft}');
      expect(screen.getByRole('slider')).toHaveValue('49');
    });

    it('jumps to min with Home', async () => {
      render(<ControlledSlider initialValue={50} min={10} max={90} aria-label="Test" />, {
        wrapper: ThemeWrapper,
      });
      await userEvent.tab();
      await userEvent.keyboard('{Home}');
      expect(screen.getByRole('slider')).toHaveValue('10');
    });

    it('jumps to max with End', async () => {
      render(<ControlledSlider initialValue={50} min={10} max={90} aria-label="Test" />, {
        wrapper: ThemeWrapper,
      });
      await userEvent.tab();
      await userEvent.keyboard('{End}');
      expect(screen.getByRole('slider')).toHaveValue('90');
    });

    it('respects step when using arrow keys', async () => {
      render(<ControlledSlider initialValue={50} step={10} aria-label="Test" />, {
        wrapper: ThemeWrapper,
      });
      await userEvent.tab();
      await userEvent.keyboard('{ArrowRight}');
      expect(screen.getByRole('slider')).toHaveValue('60');
    });

    it('does not exceed max', async () => {
      render(<ControlledSlider initialValue={99} max={100} aria-label="Test" />, {
        wrapper: ThemeWrapper,
      });
      await userEvent.tab();
      await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
      expect(screen.getByRole('slider')).toHaveValue('100');
    });

    it('does not go below min', async () => {
      render(<ControlledSlider initialValue={1} min={0} aria-label="Test" />, {
        wrapper: ThemeWrapper,
      });
      await userEvent.tab();
      await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');
      expect(screen.getByRole('slider')).toHaveValue('0');
    });
  });

  describe('ticks', () => {
    it('renders tick labels with count', () => {
      render(
        <Slider defaultValue={30} ticks={{count: 3, labels: true}} aria-label="Test" />,
        {wrapper: ThemeWrapper}
      );
      // count: 3 at 0, 50, 100. Value is 30, so "50" is unique to tick labels.
      expect(screen.getByText('50')).toBeInTheDocument();
    });

    it('renders tick labels with values', () => {
      render(
        <Slider
          defaultValue={50}
          ticks={{values: [0, 25, 75, 100], labels: true}}
          aria-label="Test"
        />,
        {wrapper: ThemeWrapper}
      );
      // 25 and 75 only appear as tick labels (not as value label or edge labels)
      expect(screen.getByText('25')).toBeInTheDocument();
      expect(screen.getByText('75')).toBeInTheDocument();
    });

    it('renders tick labels with interval', () => {
      render(
        <Slider
          defaultValue={25}
          ticks={{interval: 50, labels: true}}
          aria-label="Test"
        />,
        {wrapper: ThemeWrapper}
      );
      // Tick at 50 is unique (value is 25, edges are 0/100)
      expect(screen.getByText('50')).toBeInTheDocument();
    });
  });

  describe('formatOptions', () => {
    it('formats the value label', () => {
      render(
        <Slider
          defaultValue={42}
          formatOptions={{style: 'unit', unit: 'percent'}}
          aria-label="Test"
        />,
        {wrapper: ThemeWrapper}
      );
      // 42% only appears in the value label (not in edge labels since 42 != min or max)
      expect(screen.getByText('42%')).toBeInTheDocument();
    });

    it('formats tick labels', () => {
      render(
        <Slider
          defaultValue={25}
          ticks={{count: 3, labels: true}}
          formatOptions={{style: 'currency', currency: 'USD', maximumFractionDigits: 0}}
          aria-label="Test"
        />,
        {wrapper: ThemeWrapper}
      );
      // "$50" only appears in tick labels (value is 25, and 50 is a tick but not the value)
      expect(screen.getByText('$50')).toBeInTheDocument();
    });
  });

  describe('name prop', () => {
    it('sets name on the hidden input', () => {
      render(<Slider defaultValue={50} name="volume" aria-label="Test" />, {
        wrapper: ThemeWrapper,
      });
      expect(screen.getByRole('slider')).toHaveAttribute('name', 'volume');
    });
  });

  describe('value as empty string', () => {
    it('treats empty string value as uncontrolled', () => {
      const onChange = jest.fn();
      render(<Slider value="" onChange={onChange} aria-label="Test" />, {
        wrapper: ThemeWrapper,
      });
      expect(screen.getByRole('slider')).toBeInTheDocument();
    });
  });
});
