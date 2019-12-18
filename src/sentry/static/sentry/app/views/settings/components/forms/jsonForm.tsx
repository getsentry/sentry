import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import * as Sentry from '@sentry/browser';
import scrollToElement from 'scroll-to-element';

import {sanitizeQuerySelector} from 'app/utils/sanitizeQuerySelector';
import {Location} from 'history';

import {FieldObject, JsonFormObject} from './type';
import FieldFromConfig from './fieldFromConfig';
import FormPanel from './formPanel';

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
} & Omit<React.ComponentProps<typeof FormPanel>, 'highlighted' | 'fields'>;

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

  static defaultProps = {
    additionalFieldProps: {},
  };

  static contextTypes = {
    location: PropTypes.object,
  };

  state: State = {
    highlighted: getLocation(this.props, this.context).hash,
  };

  componentDidMount() {
    this.scrollToHash();
  }

  componentWillReceiveProps(nextProps: Props) {
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

  render() {
    const {
      forms,
      title,
      fields,

      access,
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
          forms.map(formGroup => (
            <FormPanel
              key={formGroup.title}
              title={formGroup.title}
              fields={formGroup.fields}
              {...formPanelProps}
            />
          ))}
        {typeof forms === 'undefined' && typeof fields !== 'undefined' && (
          <FormPanel title={title} fields={fields} {...formPanelProps} />
        )}
      </Box>
    );
  }
}

export default JsonForm;

function getLocation(props: Props, context: Context): Location | {hash?: string} {
  return props.location || context.location || {};
}
