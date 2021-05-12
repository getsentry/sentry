import omit from 'lodash/omit';

import RadioBoolean from './controls/radioBoolean';
import InputField from './inputField';

type Props = Omit<InputField['props'], 'field'>;

export default function RadioBooleanField(props: Props) {
  return (
    <InputField
      {...props}
      field={fieldProps => (
        <RadioBoolean {...omit(fieldProps, ['onKeyDown', 'children'])} />
      )}
    />
  );
}
