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

  render: function() {
    return (
      <div className={(this.props.className || '') + ' box'}>
        {this.props.title &&
          <div className="box-header">
            <a name={this.props.type} href={'#' + this.props.type} className="permalink">
              <em className="icon-anchor" />
            </a>
            {this.props.wrapTitle ?
              <h3>{this.props.title}</h3>
            :
              <div>{this.props.title}</div>
            }
          </div>
        }
        <div className="box-content with-padding">
          {this.props.children}
        </div>
      </div>
    );
  }
});

export default GroupEventDataSection;
