import React from 'react';
import SentryTypes from '../../proptypes';
import {t} from '../../locale';

const GroupEventDataSection = React.createClass({
  propTypes: {
    group: SentryTypes.Group.isRequired,
    event: SentryTypes.Event.isRequired,
    title: React.PropTypes.any,
    type: React.PropTypes.string.isRequired,
    wrapTitle: React.PropTypes.bool,
    toggleRaw: React.PropTypes.func,
    raw: React.PropTypes.bool
  },

  getDefaultProps() {
    return {
      wrapTitle: true,
      raw: false
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
              ? <h3>
                  {this.props.title}
                </h3>
              : <div>
                  {this.props.title}
                </div>}
            {this.props.type === 'extra' &&
              <div className="btn-group pull-right">
                <a
                  className={
                    (!this.props.raw ? 'active' : '') + ' btn btn-default btn-sm'
                  }
                  onClick={() => this.props.toggleRaw(false)}>
                  {t('Formatted')}
                </a>
                <a
                  className={(this.props.raw ? 'active' : '') + ' btn btn-default btn-sm'}
                  onClick={() => this.props.toggleRaw(true)}>
                  {t('Raw')}
                </a>
              </div>}
          </div>}
        <div className="box-content with-padding">
          {this.props.children}
        </div>
      </div>
    );
  }
});

export default GroupEventDataSection;
