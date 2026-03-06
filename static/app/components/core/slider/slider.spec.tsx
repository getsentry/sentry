import {useState} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Slider} from '@sentry/scraps/slider';

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
      render(<Slider defaultValue={50} aria-label="Test" />);
      expect(screen.getByRole('slider')).toHaveValue('50');
    });

    it('renders with controlled value', () => {
      render(<ControlledSlider initialValue={75} aria-label="Test" />);
      expect(screen.getByRole('slider')).toHaveValue('75');
    });

    it('applies aria-label', () => {
      render(<Slider defaultValue={50} aria-label="Volume" />);
      expect(screen.getByRole('slider')).toHaveAccessibleName('Volume');
    });

    it('sets min/max/step attributes on the input', () => {
      render(<Slider defaultValue={50} min={10} max={90} step={5} aria-label="Test" />);
      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('min', '10');
      expect(slider).toHaveAttribute('max', '90');
      expect(slider).toHaveAttribute('step', '5');
    });

    it('sets aria-valuetext', () => {
      render(<Slider defaultValue={30} min={0} max={100} aria-label="Test" />);
      expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '30');
    });
  });

  describe('disabled', () => {
    it('disables the slider', () => {
      render(<Slider disabled defaultValue={50} aria-label="Test" />);
      expect(screen.getByRole('slider')).toBeDisabled();
    });
  });

  describe('keyboard interaction', () => {
    it('increases value with ArrowRight', async () => {
      render(<ControlledSlider initialValue={50} aria-label="Test" />);
      const slider = screen.getByRole('slider');
      await userEvent.tab();
      expect(slider).toHaveFocus();
      await userEvent.keyboard('{ArrowRight}');
      expect(slider).toHaveValue('51');
    });

    it('decreases value with ArrowLeft', async () => {
      render(<ControlledSlider initialValue={50} aria-label="Test" />);
      await userEvent.tab();
      await userEvent.keyboard('{ArrowLeft}');
      expect(screen.getByRole('slider')).toHaveValue('49');
    });

    it('jumps to min with Home', async () => {
      render(<ControlledSlider initialValue={50} min={10} max={90} aria-label="Test" />);
      await userEvent.tab();
      await userEvent.keyboard('{Home}');
      expect(screen.getByRole('slider')).toHaveValue('10');
    });

    it('jumps to max with End', async () => {
      render(<ControlledSlider initialValue={50} min={10} max={90} aria-label="Test" />);
      await userEvent.tab();
      await userEvent.keyboard('{End}');
      expect(screen.getByRole('slider')).toHaveValue('90');
    });

    it('respects step when using arrow keys', async () => {
      render(<ControlledSlider initialValue={50} step={10} aria-label="Test" />);
      await userEvent.tab();
      await userEvent.keyboard('{ArrowRight}');
      expect(screen.getByRole('slider')).toHaveValue('60');
    });

    it('does not exceed max', async () => {
      render(<ControlledSlider initialValue={99} max={100} aria-label="Test" />);
      await userEvent.tab();
      await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
      expect(screen.getByRole('slider')).toHaveValue('100');
    });

    it('does not go below min', async () => {
      render(<ControlledSlider initialValue={1} min={0} aria-label="Test" />);
      await userEvent.tab();
      await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');
      expect(screen.getByRole('slider')).toHaveValue('0');
    });
  });

  describe('ticks', () => {
    it('renders tick labels when showTickLabels is true', () => {
      render(<Slider defaultValue={30} ticks={3} showTickLabels aria-label="Test" />);
      // ticks={3} at 0, 50, 100. Value is 30, so "50" is unique to tick labels.
      expect(screen.getByText('50')).toBeInTheDocument();
    });

    it('renders correct number of tick labels with tickValues', () => {
      render(
        <Slider
          defaultValue={50}
          tickValues={[0, 25, 75, 100]}
          showTickLabels
          aria-label="Test"
        />
      );
      // 25 and 75 only appear as tick labels (not as value label or edge labels)
      expect(screen.getByText('25')).toBeInTheDocument();
      expect(screen.getByText('75')).toBeInTheDocument();
    });

    it('renders tick labels with ticksInterval', () => {
      render(
        <Slider defaultValue={25} ticksInterval={50} showTickLabels aria-label="Test" />
      );
      // Tick at 50 is unique (value is 25, edges are 0/100)
      expect(screen.getByText('50')).toBeInTheDocument();
    });
  });

  describe('formatLabel', () => {
    it('formats the value label', () => {
      render(<Slider defaultValue={42} formatLabel={v => `${v}%`} aria-label="Test" />);
      // 42% only appears in the value label (not in edge labels since 42 != min or max)
      expect(screen.getByText('42%')).toBeInTheDocument();
    });

    it('formats tick labels', () => {
      render(
        <Slider
          defaultValue={25}
          ticks={3}
          showTickLabels
          formatLabel={v => `$${v}`}
          aria-label="Test"
        />
      );
      // "$50" only appears in tick labels (value is 25, and 50 is a tick but not the value)
      expect(screen.getByText('$50')).toBeInTheDocument();
    });
  });

  describe('name prop', () => {
    it('sets name on the hidden input', () => {
      render(<Slider defaultValue={50} name="volume" aria-label="Test" />);
      expect(screen.getByRole('slider')).toHaveAttribute('name', 'volume');
    });
  });

  describe('value as empty string', () => {
    it('treats empty string value as uncontrolled', () => {
      const onChange = jest.fn();
      render(<Slider value="" onChange={onChange} aria-label="Test" />);
      expect(screen.getByRole('slider')).toBeInTheDocument();
    });
  });
});
