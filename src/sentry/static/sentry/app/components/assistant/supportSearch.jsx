import PropTypes from 'prop-types';
import React from 'react';
import _ from 'lodash';
import createReactClass from 'create-react-class';
import $ from 'jquery';
import styled from 'react-emotion';
import {t} from '../../locale';
import ExternalLink from '../externalLink';
import HookStore from '../../stores/hookStore';
import QuestionMarkIcon from './questionMarkIcon';
import AssistantContainer from './assistantContainer';
import Input from '../../views/settings/components/forms/controls/input';
import InlineSvg from '../../components/inlineSvg';

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
      cb('assistant.search', {query: this.state.inputVal})
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
      <AssistantContainer>
        <QuestionMarkIcon />
        <StyledSearchFormContainer onSubmit={this.handleSubmit}>
          <StyledSearchIcon src="icon-search" />
          <StyledInput
            type="text"
            placeholder={t('Search FAQs and docs...')}
            onChange={this.handleChange}
            value={this.state.inputVal}
            autoFocus
          />
          {this.renderDropdownResults()}
        </StyledSearchFormContainer>
        <StyledCloseIcon src="icon-close-lg" onClick={this.props.onClose} />
        {HookStore.get('assistant:support-button').map(cb => cb(this.state.inputVal))}
      </AssistantContainer>
    );
  },
});

const StyledInput = styled(Input)`
  padding: 0.25em 0.25em 0.25em 1em;
  height: 2em;
  flex-grow: 1;
  text-indent: 1em;
  width: 275px;
  border-top-left-radius: 4em;
  border-bottom-left-radius: 4em;
`;

const StyledSearchIcon = styled(InlineSvg)`
  left: 0.875em;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  color: ${p => p.theme.gray1};
  width: 0.9em;
  height: 0.9em;
`;

const StyledCloseIcon = styled(InlineSvg)`
  right: 0.25rem;
  stroke-width: 3px;
  width: 0.75em;
  height: 0.75em;
  margin: 0 0.875em 0 0.5em;
`;

const StyledSearchFormContainer = styled('form')`
  position: relative;
  margin-left: 0.5em;
`;

export default SupportDrawer;
