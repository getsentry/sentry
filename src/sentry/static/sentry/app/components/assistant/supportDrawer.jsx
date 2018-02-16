import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import $ from 'jquery';
import ExternalLink from '../externalLink';
import HookStore from '../../stores/hookStore';

// SupportDrawer slides up when the user clicks on a "Need Help?" cue.
const SupportDrawer = createReactClass({
  displayName: 'SupportDrawer',

  propTypes: {
    onClose: PropTypes.func.isRequired,
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

  handleSubmit(evt) {
    evt.preventDefault();
  },

  handleChange(evt) {
    evt.preventDefault();
    let term = evt.currentTarget.value;

    this.setState({
      inputVal: evt.currentTarget.value,
    });

    if (term == '') {
      return;
    }
    $.ajax({
      method: 'GET',
      url: 'https://rigidsearch.getsentry.net/api/search',
      data: {
        q: term,
        page: 1,
        section: 'hosted',
      },
      success: data => {
        this.setState({docResults: data.items});
      },
    });
    $.ajax({
      method: 'GET',
      url: 'https://sentry.zendesk.com/api/v2/help_center/articles/search.json',
      data: {
        query: term,
      },
      success: data => {
        this.setState({helpcenterResults: data.results});
      },
    });
  },

  renderDocsResults() {
    return this.state.docResults.map((result, i) => {
      let {title} = result;
      let link = `https://docs.sentry.io/${result.path}/`;

      return (
        <li
          className="search-tag search-tag-docs search-autocomplete-item"
          key={i + 'doc'}
        >
          <ExternalLink href={link}>
            <span className="title">{title}</span>
          </ExternalLink>
        </li>
      );
    });
  },

  renderHelpCenterResults() {
    return this.state.helpcenterResults.map((result, i) => {
      return (
        <li className="search-tag search-tag-qa search-autocomplete-item" key={i}>
          <ExternalLink href={result.html_url}>
            <span className="title">{result.title}</span>
          </ExternalLink>
        </li>
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

  handleKeyUp(evt) {
    if (evt.key === 'Escape') {
      evt.preventDefault();
      this.props.onClose();
    }
  },

  render() {
    return (
      <div className="search" onKeyUp={this.handleKeyUp}>
        <form onSubmit={this.handleSubmit}>
          <input
            className="search-input form-control"
            type="text"
            placeholder="Search FAQs and docs..."
            onChange={this.handleChange}
            value={this.state.inputVal}
            autoFocus
          />
          <span className="icon-search" />
          <span
            className="icon-close pull-right search-close"
            onClick={this.props.onClose}
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
