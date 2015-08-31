import React from "react";
var PureRenderMixin = require('react/addons').addons.PureRenderMixin;

var SearchDropdown = React.createClass({
  mixins: [PureRenderMixin],

  render() {
    return (
      <div className="search-dropdown">
        <ul className="search-helper search-autocomplete-list">
          <li className="search-autocomplete-item">
            <span className="icon icon-tag"></span>
            <h4>Tag - <span className="search-description">key/value pair associated to an event</span></h4>
            <p className="search-example">browser:"Chrome 34"</p>
          </li>
          <li className="search-autocomplete-item">
            <span className="icon icon-toggle"></span>
            <h4>Status - <span className="search-description">State of an event</span></h4>
            <p className="search-example">is:resolved, unresolved, muted</p>
          </li>
          <li className="search-autocomplete-item">
            <span className="icon icon-user"></span>
            <h4>Assigned - <span className="search-description">team member assigned to an event</span></h4>
            <p className="search-example">assigned:[me|user@example.com]</p>
          </li>
          <li className="search-autocomplete-item">
            <span className="icon icon-hash">#</span>
            <h4><span className="search-description">or paste an event id to jump straight to it</span></h4>
          </li>
        </ul>
        <ul className="search-saved-searches search-autocomplete-list hidden">
          <li className="search-autocomplete-item">
            <a className="pull-right remove-saved-search">
              <span className="icon icon-trash"></span>
            </a>
            <span className="icon icon-search"></span>
            <h4>os:"Mac OS X 10.8", browser:"Chrome 31"</h4>
          </li>
          <li className="search-autocomplete-item">
            <a className="pull-right remove-saved-search">
              <span className="icon icon-trash"></span>
            </a>
            <span className="icon icon-search"></span>
            <h4>status:unresolved, assigned:me</h4>
          </li>
          <li className="search-autocomplete-item">
            <a className="pull-right remove-saved-search">
              <span className="icon icon-trash"></span>
            </a>
            <span className="icon icon-search"></span>
            <h4>server:"web-1", server:"web-2", server:"web-3"</h4>
          </li>
        </ul>
      </div>
    );
  }
});

export default SearchDropdown;
