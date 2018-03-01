import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import scrollToElement from 'scroll-to-element';

import FieldFromConfig from './fieldFromConfig';
import Panel from '../panel';
import PanelBody from '../panelBody';
import PanelHeader from '../panelHeader';

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
    ).isRequired,
    access: PropTypes.object,
    additionalFieldProps: PropTypes.object,
    renderFooter: PropTypes.func,
    /**
     * Renders inside of PanelBody
     */
    renderBodyStart: PropTypes.func,
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
      access,
      additionalFieldProps,
      renderFooter,
      renderBodyStart,
      // eslint-disable-next-line no-unused-vars
      location,
      ...otherProps
    } = this.props;
    let shouldRenderFooter = typeof renderFooter === 'function';
    let shouldRenderBodyStart = typeof renderBodyStart === 'function';

    return (
      <Box {...otherProps}>
        {forms.map(({title, fields}) => {
          return (
            <Panel key={title} id={title}>
              <PanelHeader>{title}</PanelHeader>
              <PanelBody>
                {shouldRenderBodyStart && renderBodyStart({title, fields})}

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
                      highlighted={this.state.highlighted === `#${field.name}`}
                    />
                  );
                })}
                {shouldRenderFooter && renderFooter({title, fields})}
              </PanelBody>
            </Panel>
          );
        })}
      </Box>
    );
  }
}

export default JsonForm;
