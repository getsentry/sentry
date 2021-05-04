import {IconCheckmark, IconSubtract} from 'app/icons';

type Props = {
  isChecked?: boolean;
  isIndeterminate?: boolean;
};

const CheckboxFancyContent = ({isChecked, isIndeterminate}: Props) => {
  if (isIndeterminate) {
    return <IconSubtract size="70%" color="white" />;
  }

  if (isChecked) {
    return <IconCheckmark size="70%" color="white" />;
  }

  return null;
};

export default CheckboxFancyContent;
