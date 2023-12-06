import {Component, Fragment} from 'react';
import {WithRouterProps} from 'react-router';
import * as Sentry from '@sentry/react';
import scrollToElement from 'scroll-to-element';

import {defined} from 'sentry/utils';
import {sanitizeQuerySelector} from 'sentry/utils/sanitizeQuerySelector';
// eslint-disable-next-line no-restricted-imports
import withSentryRouter from 'sentry/utils/withSentryRouter';

import FormPanel, {FormPanelProps} from './formPanel';
import type {Field, FieldObject, JsonFormObject} from './types';

interface JsonFormProps
  extends WithRouterProps,
    Omit<FormPanelProps, 'highlighted' | 'fields' | 'additionalFieldProps'> {
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
}

type State = {
  // Field name that should be highlighted
  highlighted?: string;
};

interface ChildFormPanelProps
  extends Pick<
    FormPanelProps,
    | 'access'
    | 'disabled'
    | 'features'
    | 'additionalFieldProps'
    | 'renderFooter'
    | 'renderHeader'
    | 'initiallyCollapsed'
    | 'collapsible'
  > {
  highlighted?: State['highlighted'];
}

class JsonForm extends Component<JsonFormProps, State> {
  state: State = {
    // location.hash is optional because of tests.
    highlighted: this.props.location?.hash,
  };

  componentDidMount() {
    this.scrollToHash();
  }

  componentDidUpdate(prevProps: JsonFormProps) {
    if (this.props.location && this.props.location.hash !== prevProps.location.hash) {
      const hash = this.props.location.hash;
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

  shouldDisplayForm(fields: FieldObject[]): boolean {
    const fieldsWithVisibleProp = fields.filter(
      (field): field is Field => typeof field !== 'function' && defined(field?.visible)
    );

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
    initiallyCollapsed,
  }: {
    fields: FieldObject[];
    formPanelProps: ChildFormPanelProps;
    initiallyCollapsed?: boolean;
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

    return (
      <FormPanel
        title={title}
        fields={fields}
        {...formPanelProps}
        initiallyCollapsed={initiallyCollapsed ?? formPanelProps.initiallyCollapsed}
      />
    );
  }

  render() {
    const {
      access,
      collapsible,
      initiallyCollapsed = false,
      fields,
      title,
      forms,
      disabled,
      features,
      additionalFieldProps,
      renderFooter,
      renderHeader,
      location: _location,
      params: _params,
      router: _router,
      routes: _routes,
      ...otherProps
    } = this.props;

    const formPanelProps: ChildFormPanelProps = {
      access,
      disabled,
      features,
      additionalFieldProps,
      renderFooter,
      renderHeader,
      highlighted: this.state.highlighted,
      collapsible,
      initiallyCollapsed,
    };

    return (
      <div {...otherProps}>
        {typeof forms !== 'undefined' &&
          forms.map((formGroup, i) => (
            <Fragment key={i}>{this.renderForm({formPanelProps, ...formGroup})}</Fragment>
          ))}
        {typeof forms === 'undefined' &&
          typeof fields !== 'undefined' &&
          this.renderForm({fields, formPanelProps, title})}
      </div>
    );
  }
}

export default withSentryRouter(JsonForm);
