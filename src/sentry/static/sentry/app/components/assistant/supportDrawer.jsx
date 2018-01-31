import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import $ from 'jquery';
import HookStore from '../../stores/hookStore';

const SupportDrawer = createReactClass({
  displayName: 'SupportDrawer',

  propTypes: {
    closeHandler: PropTypes.func.isRequired,
    subscription: PropTypes.object,
  },

  getInitialState() {
    return {
      inputVal: '',
      docResults: [],
      helpcenterResults: [],
    };
  },

  componentWillReceiveProps(props) {
    this.setState({inputVal: ''});
  },

  handleInput(evt) {
    evt.preventDefault();
    let term = encodeURIComponent(evt.currentTarget.value);
    this.setState({
      inputVal: evt.currentTarget.value,
    });
    if (term == '') {
      return;
    }
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

  renderDocsResults() {
    return this.state.docResults.map((result, i) => {
      let {title} = result;
      let link = `https://docs.sentry.io/${result.path}/`;

      return (
        <a href={link} key={i + 'doc'}>
          <li className="search-tag search-tag-docs search-autocomplete-item">
            <span className="title">{title}</span>
          </li>
        </a>
      );
    });
  },

  renderHelpCenterResults() {
    return this.state.helpcenterResults.map((result, i) => {
      return (
        <a href={result.html_url} key={i}>
          <li className="search-tag search-tag-qa search-autocomplete-item">
            <span className="title">{result.title}</span>
          </li>
        </a>
      );
    });
  },

  renderDropdownResults() {
    let docsResults = this.renderDocsResults();
    let helpcenterResults = this.renderHelpCenterResults();
    let results = helpcenterResults.concat(docsResults);

    return (
      <div
        className="results"
        style={{
          visibility: this.state.inputVal.length > 2 ? 'visible' : 'hidden',
        }}
      >
        <ul className="search-autocomplete-list">{results}</ul>
      </div>
    );
  },

  zendeskHandler() {},

  render() {
    return (
      <div className="search">
        <form>
          <input
            className="search-input form-control"
            type="text"
            placeholder="Search FAQs and docs..."
            onChange={this.handleInput}
            value={this.state.inputVal}
          />
          <span className="icon-search" />
          <span
            className="icon-close pull-right search-close"
            onClick={this.props.closeHandler}
            style={{cursor: 'pointer'}}
          />
          {this.renderDropdownResults()}
        </form>
        {HookStore.get('assistant:support-button').map(cb => cb(this.state.inputVal))}
      </div>
    );
  },
});

export default SupportDrawer;
