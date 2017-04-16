import React from 'react';
import PropTypes from '../../proptypes';

const GroupEventDataSection = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired,
    title: React.PropTypes.any,
    type: React.PropTypes.string.isRequired,
    wrapTitle: React.PropTypes.bool
  },

  getDefaultProps() {
    return {
      wrapTitle: true
    };
  },

  componentDidMount() {
    if (location.hash) {
      let [, hash] = location.hash.split('#');

      try {
        let anchorElement = hash && document.querySelector('div#' + hash);
        if (anchorElement) {
          anchorElement.scrollIntoView();
        }
      } catch (e) {
        // Since we're blindly taking the hash from the url and shoving
        // it into a querySelector, it's possible that this may
        // raise an exception if the input is invalid. So let's just ignore
        // this instead of blowing up.
        // e.g. `document.querySelector('div#=')`
        // > Uncaught DOMException: Failed to execute 'querySelector' on 'Document': 'div#=' is not a valid selector.
      }
    }
  },

  render: function() {
    return (
      <div className={(this.props.className || '') + ' box'}>
        {this.props.title &&
          <div className="box-header" id={this.props.type}>
            <a href={'#' + this.props.type} className="permalink">
              <em className="icon-anchor" />
            </a>
            {this.props.wrapTitle
              ? <h3>{this.props.title}</h3>
              : <div>{this.props.title}</div>}
          </div>}
        <div className="box-content with-padding">
          {this.props.children}
        </div>
      </div>
    );
  }
});

export default GroupEventDataSection;
