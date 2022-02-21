import * as React from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import * as Sentry from '@sentry/react';
import scrollToElement from 'scroll-to-element';

import {defined} from 'sentry/utils';
import {sanitizeQuerySelector} from 'sentry/utils/sanitizeQuerySelector';

import FormPanel from './formPanel';
import {Field, FieldObject, JsonFormObject} from './type';

type Props = {
  additionalFieldProps?: {[key: string]: any};

  /**
   * If `forms` is not defined, `title` + `fields` must be required.
   * Allows more fine grain control of title/fields
   */
  fields?: FieldObject[];

  /**
   * Fields that are grouped by "section"
   */
  forms?: JsonFormObject[];
} & WithRouterProps &
  Omit<
    React.ComponentProps<typeof FormPanel>,
    'highlighted' | 'fields' | 'additionalFieldProps'
  >;

type State = {
  // Field name that should be highlighted
  highlighted?: string;
};

class JsonForm extends React.Component<Props, State> {
  state: State = {
    // location.hash is optional because of tests.
    highlighted: this.props.location?.hash,
  };

  componentDidMount() {
    this.scrollToHash();
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    if (nextProps.location && this.props.location.hash !== nextProps.location.hash) {
      const hash = nextProps.location.hash;
      this.scrollToHash(hash);
      this.setState({highlighted: hash});
    }
  }

  scrollToHash(toHash?: string): void {
    // location.hash is optional because of tests.
    const hash = toHash || this.props.location?.hash;

    if (!hash) {
      return;
    }

    // Push onto callback queue so it runs after the DOM is updated,
    // this is required when navigating from a different page so that
    // the element is rendered on the page before trying to getElementById.
    try {
      scrollToElement(sanitizeQuerySelector(decodeURIComponent(hash)), {
        align: 'middle',
        offset: -100,
      });
    } catch (err) {
      Sentry.captureException(err);
    }
  }

  shouldDisplayForm(fields: FieldObject[]) {
    const fieldsWithVisibleProp = fields.filter(
      field => typeof field !== 'function' && defined(field?.visible)
    ) as Array<Omit<Field, 'visible'> & Required<Pick<Field, 'visible'>>>;

    if (fields.length === fieldsWithVisibleProp.length) {
      const {additionalFieldProps, ...props} = this.props;

      const areAllFieldsHidden = fieldsWithVisibleProp.every(field => {
        if (typeof field.visible === 'function') {
          return !field.visible({...props, ...additionalFieldProps});
        }
        return !field.visible;
      });

      return !areAllFieldsHidden;
    }

    return true;
  }

  renderForm({
    fields,
    formPanelProps,
    title,
  }: {
    fields: FieldObject[];
    formPanelProps: Pick<
      Props,
      | 'access'
      | 'disabled'
      | 'features'
      | 'additionalFieldProps'
      | 'renderFooter'
      | 'renderHeader'
    > &
      Pick<State, 'highlighted'>;
    title?: React.ReactNode;
  }) {
    const shouldDisplayForm = this.shouldDisplayForm(fields);

    if (
      !shouldDisplayForm &&
      !formPanelProps?.renderFooter &&
      !formPanelProps?.renderHeader
    ) {
      return null;
    }

    return <FormPanel title={title} fields={fields} {...formPanelProps} />;
  }

  render() {
    const {
      access,
      collapsible,
      fields,
      title,
      forms,
      disabled,
      features,
      additionalFieldProps,
      renderFooter,
      renderHeader,
      location: _location,
      ...otherProps
    } = this.props;

    const formPanelProps = {
      access,
      disabled,
      features,
      additionalFieldProps,
      renderFooter,
      renderHeader,
      highlighted: this.state.highlighted,
      collapsible,
    };

    return (
      <div {...otherProps}>
        {typeof forms !== 'undefined' &&
          forms.map((formGroup, i) => (
            <React.Fragment key={i}>
              {this.renderForm({formPanelProps, ...formGroup})}
            </React.Fragment>
          ))}
        {typeof forms === 'undefined' &&
          typeof fields !== 'undefined' &&
          this.renderForm({fields, formPanelProps, title})}
      </div>
    );
  }
}

export default withRouter(JsonForm);
