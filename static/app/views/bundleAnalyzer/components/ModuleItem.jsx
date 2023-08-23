import {Component} from 'react';
import cls from 'classnames';
import escapeRegExp from 'escape-string-regexp';
import {filesize} from 'filesize';
import escape from 'lodash.escape';

import s from './ModuleItem.css';

export default class ModuleItem extends Component {
  state = {
    visible: true,
  };

  get itemType() {
    const {module} = this.props;
    if (!module.path) {
      return 'chunk';
    }
    return module.groups ? 'folder' : 'module';
  }

  get titleHtml() {
    let html;
    const {module} = this.props;
    const title = module.path || module.label;
    const term = this.props.highlightedText;

    if (term) {
      const regexp =
        term instanceof RegExp
          ? new RegExp(term.source, 'igu')
          : new RegExp(`(?:${escapeRegExp(term)})+`, 'iu');
      let match;
      let lastMatch;

      do {
        lastMatch = match;
        match = regexp.exec(title);
      } while (match);

      if (lastMatch) {
        html =
          escape(title.slice(0, lastMatch.index)) +
          `<strong>${escape(lastMatch[0])}</strong>` +
          escape(title.slice(lastMatch.index + lastMatch[0].length));
      }
    }

    if (!html) {
      html = escape(title);
    }

    return html;
  }

  get invisibleHint() {
    const itemType = this.itemType.charAt(0).toUpperCase() + this.itemType.slice(1);
    return `${itemType} is not rendered in the treemap because it's too small.`;
  }

  get isVisible() {
    const {isVisible} = this.props;
    return isVisible ? isVisible(this.props.module) : true;
  }

  handleClick = () => this.props.onClick(this.props.module);

  handleMouseEnter = () => {
    if (this.props.isVisible) {
      this.setState({visible: this.isVisible});
    }
  };

  render() {
    const {module, showSize} = this.props;
    const invisible = !this.state.visible;
    const classes = cls(s.container, s[this.itemType], {
      [s.invisible]: invisible,
    });

    return (
      <div
        className={classes}
        title={invisible ? this.invisibleHint : null}
        onClick={this.handleClick}
        onMouseEnter={this.handleMouseEnter}
        onMouseLeave={this.handleMouseLeave}
      >
        <span dangerouslySetInnerHTML={{__html: this.titleHtml}} />
        {showSize && [
          ' (',
          <strong key={module[size]}>{filesize(module[showSize])}</strong>,
          ')',
        ]}
      </div>
    );
  }
}
