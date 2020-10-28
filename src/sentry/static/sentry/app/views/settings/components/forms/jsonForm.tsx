import {Box} from 'reflexbox';
import PropTypes from 'prop-types';
import React from 'react';
import scrollToElement from 'scroll-to-element';
import {Location} from 'history';
import * as Sentry from '@sentry/react';

import {defined} from 'app/utils';
import {sanitizeQuerySelector} from 'app/utils/sanitizeQuerySelector';

import {Field, FieldObject, JsonFormObject} from './type';
import FieldFromConfig from './fieldFromConfig';
import FormPanel from './formPanel';

type DefaultProps = {
  additionalFieldProps: {[key: string]: any};
};

type Props = {
  /**
   * Fields that are grouped by "section"
   */
  forms?: JsonFormObject[];

  /**
   * If `forms` is not defined, `title` + `fields` must be required.
   * Allows more fine grain control of title/fields
   */
  fields?: FieldObject[];
  location?: Location;
} & DefaultProps &
  Omit<
    React.ComponentProps<typeof FormPanel>,
    'highlighted' | 'fields' | 'additionalFieldProps'
  >;

type Context = {
  location?: Location;
};

type State = {
  // Field name that should be highlighted
  highlighted?: string;
};

class JsonForm extends React.Component<Props, State> {
  static propTypes = {
    /**
     * Fields that are grouped by "section"
     */
    forms: PropTypes.arrayOf(
      PropTypes.shape({
        title: PropTypes.string,
        fields: PropTypes.arrayOf(
          PropTypes.oneOfType([PropTypes.func, FieldFromConfig.propTypes.field])
        ),
      })
    ),

    /**
     * If `forms` is not defined, `title` + `fields` must be required.
     * Allows more fine grain control of title/fields
     */
    fields: PropTypes.arrayOf(
      PropTypes.oneOfType([PropTypes.func, FieldFromConfig.propTypes.field])
    ),
    /**
     * Panel title if `forms` is not defined
     */
    title: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),

    access: PropTypes.object,
    features: PropTypes.object,
    renderFooter: PropTypes.func,
    /**
     * Renders inside of PanelBody
     */
    renderHeader: PropTypes.func,
    /**
     * Disables the entire form
     */
    disabled: PropTypes.bool,
  };

  static contextTypes = {
    location: PropTypes.object,
  };

  static defaultProps: DefaultProps = {
    additionalFieldProps: {},
  };

  state: State = {
    highlighted: getLocation(this.props, this.context).hash,
  };

  componentDidMount() {
    this.scrollToHash();
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    if (
      getLocation(this.props, this.context).hash !==
      getLocation(nextProps, this.context).hash
    ) {
      const hash = getLocation(nextProps, this.context).hash;
      this.scrollToHash(hash);
      this.setState({highlighted: hash});
    }
  }

  scrollToHash(toHash?: string): void {
    const hash = toHash || getLocation(this.props, this.context).hash;

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
    };

    return (
      <Box {...otherProps}>
        {typeof forms !== 'undefined' &&
          forms.map((formGroup, i) => (
            <React.Fragment key={i}>
              {this.renderForm({formPanelProps, ...formGroup})}
            </React.Fragment>
          ))}
        {typeof forms === 'undefined' &&
          typeof fields !== 'undefined' &&
          this.renderForm({fields, formPanelProps, title})}
      </Box>
    );
  }
}

export default JsonForm;

function getLocation(props: Props, context: Context): Location | {hash?: string} {
  return props.location || context.location || {};
}
