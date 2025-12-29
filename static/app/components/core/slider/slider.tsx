import {Slider as ChonkSlider} from './slider.chonk';

interface BaseProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'type' | 'value' | 'onChange' | 'defaultValue'
  > {
  defaultValue?: number;
  /** Optional callback to format the label */
  formatLabel?: (value: number | '') => React.ReactNode;
  ref?: React.Ref<HTMLInputElement>;
}

interface ControlledProps extends BaseProps {
  onChange: (value: number, event: React.ChangeEvent<HTMLInputElement>) => void;
  value: number | '';
}

interface UncontrolledProps extends BaseProps {
  defaultValue?: number;
  onChange?: never;
  value?: never;
}

export type SliderProps = ControlledProps | UncontrolledProps;

export const Slider = ChonkSlider;
