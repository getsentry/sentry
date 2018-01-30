import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import $ from 'jquery';

const SupportDrawer = createReactClass({
  displayName: 'SupportDrawer',

  propTypes: {
    closeHandler: PropTypes.func.isRequired,
  },

  getInitialState() {
    return {
      helpText: '',
      docResults: [],
      helpcenterResults: [],
    };
  },

  handleInput(event) {
    // Handles input event to update state
    this.setState({
      helpText: event.currentTarget.value,
    });
  },

  handleSearch(event) {
    event.preventDefault();
    let term = encodeURIComponent(this.state.helpText);
    $.get(
      `https://rigidsearch.getsentry.net/api/search?q=${term}&page=1&section=hosted`,
      data => {
        this.setState({docResults: data.items});
      }
    );
    $.get(
      `https://sentry.zendesk.com/api/v2/help_center/articles/search.json?query=${term}`,
      data => {
        this.setState({helpcenterResults: data.results});
      }
    );
  },

  render() {
    return (
      <div>
        <div className="search">
          <form onSubmit={this.handleSearch}>
            <input
              style={{color: 'black'}}
              onChange={this.handleInput}
              value={this.state.helpText}
            />
          </form>
        </div>
        <div onClick={this.props.closeHandler}>Close</div>
      </div>
    );
  },
});

export default SupportDrawer;
