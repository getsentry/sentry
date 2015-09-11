import React from "react";
import classNames from "classnames";

import LoadingIndicator from "../../components/loadingIndicator";

var PureRenderMixin = require('react/addons').addons.PureRenderMixin;

var SearchDropdown = React.createClass({
  mixins: [PureRenderMixin],

  defaultProps: {
    onClick: function () {}
  },

  onClick(itemValue) {
    this.props.onClick(itemValue);
  },

  render() {
    return (
      <div className="search-dropdown">
        <ul className="search-helper search-autocomplete-list">
          {this.props.loading
            ? <li key="loading" className="search-autocomplete-item"><LoadingIndicator mini={true}/></li>
            : this.props.items.map((item) => {
              return (
                <li key={item.value || item.desc} className={classNames("search-autocomplete-item", item.active && 'active')} onClick={this.onClick.bind(this, item.value)}>
                  <span className={classNames("icon", item.className)}></span>
                  <h4>{ item.title && item.title + ' - '}<span className="search-description">{item.desc}</span></h4>
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