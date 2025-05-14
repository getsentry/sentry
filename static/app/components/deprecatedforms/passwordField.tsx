import InputField from 'sentry/components/deprecatedforms/inputField';
import withFormContext from 'sentry/components/deprecatedforms/withFormContext';
import FormState from 'sentry/components/forms/state';

type Props = InputField['props'] & {
  formState?: (typeof FormState)[keyof typeof FormState];
  hasSavedValue?: boolean;
  prefix?: string;
};

type State = InputField['state'] & {
  editing: boolean;
};

// TODO(dcramer): im not entirely sure this is working correctly with
// value propagation in all scenarios

/**
 * @deprecated Do not use this
 */
class PasswordField extends InputField<Props, State> {
  static defaultProps = {
    ...InputField.defaultProps,
    hasSavedValue: false,
    prefix: '',
  };

  constructor(props: Props) {
    super(props);

    this.state = {...this.state, editing: false};
  }

  componentDidUpdate(prevProps: Props) {
    // close edit mode after successful save
    // TODO(dcramer): this needs to work with this.context.form
    if (
      this.props.formState &&
      prevProps.formState === FormState.SAVING &&
      this.props.formState === FormState.READY
    ) {
      this.setState({editing: false});
    }
  }

  getType() {
    return 'password';
  }

  cancelEdit = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    this.setState({editing: false}, () => this.setValue(''));
  };

  startEdit = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    this.setState({editing: true});
  };

  getField() {
    if (!this.props.hasSavedValue) {
      return super.getField();
    }

    if (this.state.editing) {
      return (
        <div className="form-password editing">
          <div>{super.getField()}</div>
          <div>
            <a onClick={this.cancelEdit}>Cancel</a>
          </div>
        </div>
      );
    }
    return (
      <div className="form-password saved">
        <span>
          {this.props.prefix + new Array(21 - this.props.prefix!.length).join('*')}
        </span>
        {!this.props.disabled && <a onClick={this.startEdit}>Edit</a>}
      </div>
    );
  }
}

/**
 * @deprecated Do not use this
 */
export default withFormContext(PasswordField);
