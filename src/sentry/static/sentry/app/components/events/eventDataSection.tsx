import PropTypes from 'prop-types';
import React from 'react';
import {t} from 'app/locale';
import {callIfFunction} from 'app/utils/callIfFunction';
import GuideAnchor from 'app/components/assistant/guideAnchor';

const defaultProps = {
  wrapTitle: true,
  raw: false,
  hideGuide: false,
};

type DefaultProps = Readonly<typeof defaultProps>;

type Props = {
  className?: string;
  title: React.ReactText;
  type: string;
  toggleRaw?: (enable: boolean) => void;
} & Partial<DefaultProps>;

class EventDataSection extends React.Component<Props> {
  static propTypes = {
    title: PropTypes.any,
    type: PropTypes.string.isRequired,
    wrapTitle: PropTypes.bool,
    toggleRaw: PropTypes.func,
    raw: PropTypes.bool,
    hideGuide: PropTypes.bool,
  };

  static defaultProps = defaultProps;

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

    let titleNode = wrapTitle ? <h3>{title}</h3> : <div>{title}</div>;
    if (type === 'tags' && hideGuide === false) {
      titleNode = (
        <GuideAnchor target="tags" position="top">
          {titleNode}
        </GuideAnchor>
      );
    }

    return (
      <div className={(className || '') + ' box'}>
        {title && (
          <div className="box-header" id={type}>
            <a href={'#' + type} className="permalink">
              <em className="icon-anchor" />
            </a>
            {titleNode}
            {type === 'extra' && (
              <div className="btn-group pull-right">
                <a
                  className={(!raw ? 'active' : '') + ' btn btn-default btn-sm'}
                  onClick={() => callIfFunction(toggleRaw, false)}
                >
                  {t('Formatted')}
                </a>
                <a
                  className={(raw ? 'active' : '') + ' btn btn-default btn-sm'}
                  onClick={() => callIfFunction(toggleRaw, true)}
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
