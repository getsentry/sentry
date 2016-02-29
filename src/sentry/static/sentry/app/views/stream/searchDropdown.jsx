import React from 'react';
import classNames from 'classnames';

import LoadingIndicator from '../../components/loadingIndicator';

import PureRenderMixin from 'react-addons-pure-render-mixin';

const SearchDropdown = React.createClass({
  propTypes: {
    items: React.PropTypes.array.isRequired,
    searchSubstring: React.PropTypes.string,
    onClick: React.PropTypes.func.isRequired,
    loading: React.PropTypes.bool
  },

  mixins: [PureRenderMixin],

  getDefaultProps() {
    return {
      searchSubstring: '',
      onClick: function () {}
    };
  },

  onClick(itemValue) {
    this.props.onClick(itemValue);
  },

  renderDescription(item) {
    let searchSubstring = this.props.searchSubstring;
    if (!searchSubstring)
      return item.desc;

    let text = item.desc;
    let idx = text.toLowerCase().indexOf(searchSubstring.toLowerCase());

    if (idx === -1)
      return item.desc;

    return (
      <span>
        {text.substr(0, idx)}
        <strong>{text.substr(idx, searchSubstring.length)}</strong>
        {text.substr(idx + searchSubstring.length)}
      </span>
    );
  },

  render() {
    return (
      <div className="search-dropdown">
        <ul className="search-helper search-autocomplete-list">
          {this.props.loading
            ? <li key="loading" className="search-autocomplete-item"><LoadingIndicator mini={true}/></li>
            : this.props.items.map((item) => {
              return (
                <li key={item.value || item.desc} className={classNames('search-autocomplete-item', item.active && 'active')} onClick={this.onClick.bind(this, item.value)}>
                  <span className={classNames('icon', item.className)}></span>
                  <h4>{ item.title && item.title + ' - '}<span className="search-description">{this.renderDescription(item)}</span></h4>
                  {item.example ?
                    <p className="search-example">{item.example}</p> : ''
                  }
                </li>
              );
            })}
        </ul>
      </div>
    );
  }
});

export default SearchDropdown;
