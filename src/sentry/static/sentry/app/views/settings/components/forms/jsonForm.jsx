import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import scrollToElement from 'scroll-to-element';

import {defined} from 'app/utils';
import FieldFromConfig from 'app/views/settings/components/forms/fieldFromConfig';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';

class JsonForm extends React.Component {
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
    title: PropTypes.string,

    access: PropTypes.object,
    features: PropTypes.object,
    additionalFieldProps: PropTypes.object,
    renderFooter: PropTypes.func,
    /**
     * Renders inside of PanelBody
     */
    renderHeader: PropTypes.func,
  };

  static defaultProps = {
    additionalFieldProps: {},
  };

  static contextTypes = {
    location: PropTypes.object,
  };

  constructor(props, ...args) {
    super(props, ...args);
    this.state = {highlighted: this.getLocation(props).hash};
  }

  componentDidMount() {
    this.scrollToHash();
  }

  componentWillReceiveProps(nextProps, e) {
    if (this.getLocation(this.props).hash !== this.getLocation(nextProps).hash) {
      let hash = this.getLocation(nextProps).hash;
      this.scrollToHash(hash);
      this.setState({highlighted: hash});
    }
  }

  getLocation = props => {
    return props.location || this.context.location || {};
  };

  scrollToHash(toHash) {
    let hash = toHash || this.getLocation(this.props).hash;

    if (!hash) return;

    // Push onto callback queue so it runs after the DOM is updated,
    // this is required when navigating from a different page so that
    // the element is rendered on the page before trying to getElementById.
    scrollToElement(hash, {align: 'middle', offset: -100});
  }

  render() {
    let {
      forms,
      title,
      fields,

      access,
      features,
      additionalFieldProps,
      renderFooter,
      renderHeader,
      // eslint-disable-next-line no-unused-vars
      location,
      ...otherProps
    } = this.props;

    let hasFormGroups = defined(forms);
    let formPanelProps = {
      access,
      features,
      additionalFieldProps,
      renderFooter,
      renderHeader,
      highlighted: this.state.highlighted,
    };

    return (
      <Box {...otherProps}>
        {hasFormGroups ? (
          forms.map(formGroup => (
            <FormPanel
              key={formGroup.title}
              title={formGroup.title}
              fields={formGroup.fields}
              {...formPanelProps}
            />
          ))
        ) : (
          <FormPanel title={title} fields={fields} {...formPanelProps} />
        )}
      </Box>
    );
  }
}

export default JsonForm;

class FormPanel extends React.Component {
  static propTypes = {
    /**
     * Panel title
     */
    title: PropTypes.string,
    /**
     * List of fields to render
     */
    fields: PropTypes.arrayOf(
      PropTypes.oneOfType([PropTypes.func, FieldFromConfig.propTypes.field])
    ),

    access: PropTypes.object,
    additionalFieldProps: PropTypes.object,

    /**
     * The name of the field that should be highlighted
     */
    highlighted: PropTypes.string,

    /**
     * Renders inside of PanelBody at the start
     */
    renderHeader: PropTypes.func,
    /**
     * Renders inside of PanelBody before PanelBody close
     */
    renderFooter: PropTypes.func,
  };

  render() {
    let {
      title,
      fields,
      access,
      additionalFieldProps,
      renderFooter,
      renderHeader,
      // eslint-disable-next-line no-unused-vars
      location,
      ...otherProps
    } = this.props;
    let shouldRenderFooter = typeof renderFooter === 'function';
    let shouldRenderHeader = typeof renderHeader === 'function';

    return (
      <Panel key={title} id={title}>
        <PanelHeader>{title}</PanelHeader>
        <PanelBody>
          {shouldRenderHeader && renderHeader({title, fields})}

          {fields.map(field => {
            if (typeof field === 'function') {
              return field();
            }

            // eslint-disable-next-line no-unused-vars
            let {defaultValue, ...fieldWithoutDefaultValue} = field;

            return (
              <FieldFromConfig
                access={access}
                key={field.name}
                {...otherProps}
                {...additionalFieldProps}
                field={fieldWithoutDefaultValue}
                highlighted={this.props.highlighted === `#${field.name}`}
              />
            );
          })}
          {shouldRenderFooter && renderFooter({title, fields})}
        </PanelBody>
      </Panel>
    );
  }
}
