import PropTypes from 'prop-types';
import React from 'react';
import {t} from 'app/locale';
import GuideAnchor from 'app/components/assistant/guideAnchor';

class EventDataSection extends React.Component {
  static propTypes = {
    title: PropTypes.any,
    type: PropTypes.string.isRequired,
    wrapTitle: PropTypes.bool,
    toggleRaw: PropTypes.func,
    raw: PropTypes.bool,
    hideGuide: PropTypes.bool,
  };

  static defaultProps = {
    wrapTitle: true,
    raw: false,
    hideGuide: false,
  };

  componentDidMount() {
    if (location.hash) {
      const [, hash] = location.hash.split('#');

      try {
        const anchorElement = hash && document.querySelector('div#' + hash);
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
    const {
      children,
      className,
      hideGuide,
      type,
      title,
      toggleRaw,
      raw,
      wrapTitle,
    } = this.props;
    const guideAnchor =
      type === 'tags' && hideGuide === false ? (
        <GuideAnchor target="tags" type="text" />
      ) : null;

    return (
      <div className={(className || '') + ' box'}>
        {title && (
          <div className="box-header" id={type}>
            <a href={'#' + type} className="permalink">
              <em className="icon-anchor" />
            </a>
            {wrapTitle ? (
              <h3>
                {guideAnchor}
                {title}
              </h3>
            ) : (
              <div>
                {guideAnchor}
                {title}
              </div>
            )}
            {type === 'extra' && (
              <div className="btn-group pull-right">
                <a
                  className={(!raw ? 'active' : '') + ' btn btn-default btn-sm'}
                  onClick={() => toggleRaw(false)}
                >
                  {t('Formatted')}
                </a>
                <a
                  className={(raw ? 'active' : '') + ' btn btn-default btn-sm'}
                  onClick={() => toggleRaw(true)}
                >
                  {t('Raw')}
                </a>
              </div>
            )}
          </div>
        )}
        <div className="box-content with-padding">{children}</div>
      </div>
    );
  }
}

export default EventDataSection;
