import PropTypes from 'prop-types';
import React from 'react';
import {t} from 'app/locale';
import GuideAnchor from 'app/components/assistant/guideAnchor';

class GroupEventDataSection extends React.Component {
  static propTypes = {
    title: PropTypes.any,
    type: PropTypes.string.isRequired,
    wrapTitle: PropTypes.bool,
    toggleRaw: PropTypes.func,
    raw: PropTypes.bool,
  };

  static defaultProps = {
    wrapTitle: true,
    raw: false,
  };

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
  }

  render() {
    const guideAnchor =
      this.props.type === 'tags' ? <GuideAnchor target="tags" type="text" /> : null;

    return (
      <div className={(this.props.className || '') + ' box'}>
        {this.props.title && (
          <div className="box-header" id={this.props.type}>
            <a href={'#' + this.props.type} className="permalink">
              <em className="icon-anchor" />
            </a>
            {this.props.wrapTitle ? (
              <h3>
                {guideAnchor}
                {this.props.title}
              </h3>
            ) : (
              <div>
                {guideAnchor}
                {this.props.title}
              </div>
            )}
            {this.props.type === 'extra' && (
              <div className="btn-group pull-right">
                <a
                  className={
                    (!this.props.raw ? 'active' : '') + ' btn btn-default btn-sm'
                  }
                  onClick={() => this.props.toggleRaw(false)}
                >
                  {t('Formatted')}
                </a>
                <a
                  className={(this.props.raw ? 'active' : '') + ' btn btn-default btn-sm'}
                  onClick={() => this.props.toggleRaw(true)}
                >
                  {t('Raw')}
                </a>
              </div>
            )}
          </div>
        )}
        <div className="box-content with-padding">{this.props.children}</div>
      </div>
    );
  }
}

export default GroupEventDataSection;
