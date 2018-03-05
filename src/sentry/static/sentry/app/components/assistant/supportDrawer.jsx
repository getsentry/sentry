import PropTypes from 'prop-types';
import React from 'react';
import _ from 'lodash';
import createReactClass from 'create-react-class';
import $ from 'jquery';
import {t} from '../../locale';
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

  search: _.debounce(function() {
    if (this.state.inputVal.length <= 2) {
      this.setState({
        docResults: [],
        helpcenterResults: [],
      });
      return;
    }
    $.ajax({
      method: 'GET',
      url: 'https://rigidsearch.getsentry.net/api/search',
      data: {
        q: this.state.inputVal,
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
        query: this.state.inputVal,
      },
      success: data => {
        this.setState({helpcenterResults: data.results});
      },
    });

    HookStore.get('analytics:event').forEach(cb =>
      cb('support.search', {query: this.state.inputVal})
    );
  }, 300),

  handleChange(evt) {
    this.setState({inputVal: evt.currentTarget.value}, this.search);
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
      <div className="results">
        <ul className="search-autocomplete-list">{results}</ul>
      </div>
    );
  },

  render() {
    return (
      <div className="search">
        <form onSubmit={this.handleSubmit}>
          <input
            className="search-input form-control"
            type="text"
            placeholder={t('Search FAQs and docs...')}
            onChange={this.handleChange}
            value={this.state.inputVal}
            autoFocus
          />
          <span className="icon-search" />
          <a
            className="icon-close pull-right search-close"
            onClick={this.props.onClose}
          />
          {this.renderDropdownResults()}
        </form>
        {HookStore.get('assistant:support-button').map(cb => cb(this.state.inputVal))}
      </div>
    );
  },
});

export default SupportDrawer;
