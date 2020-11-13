import PropTypes from 'prop-types';

import InputField from 'app/components/forms/inputField';

type Props = InputField['props'] & {
  spellCheck?: string;
};

export default class TextField extends InputField<Props> {
  static propTypes = {
    spellCheck: PropTypes.string,
  } as any; // TODO(ts): remove when proptypes are no longer required, some views don't implement all required proptypes of underlying InputField.

  getAttributes() {
    return {
      spellCheck: this.props.spellCheck,
    };
  }

  getType() {
    return 'text';
  }
}
