import PropTypes from 'prop-types';
import React from 'react';
import _ from 'lodash';
import createReactClass from 'create-react-class';
import $ from 'jquery';
import styled from 'react-emotion';
import {t} from 'app/locale';
import analytics from 'app/utils/analytics';
import ExternalLink from 'app/components/externalLink';
import HookStore from 'app/stores/hookStore';
import CueIcon from 'app/components/assistant/cueIcon';
import CloseIcon from 'app/components/assistant/closeIcon';
import AssistantContainer from 'app/components/assistant/assistantContainer';
import Input from 'app/views/settings/components/forms/controls/input';
import InlineSvg from 'app/components/inlineSvg';

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

    analytics('assistant.search', {query: this.state.inputVal});
  }, 300),

  handleChange(evt) {
    this.setState({inputVal: evt.currentTarget.value}, this.search);
  },

  renderDocsResults() {
    return this.state.docResults.map((result, i) => {
      let {title} = result;
      let link = `https://docs.sentry.io/${result.path}/`;

      return (
        <StyledExternalLink key={i + 'doc'} href={link}>
          {title}
        </StyledExternalLink>
      );
    });
  },

  renderHelpCenterResults() {
    return this.state.helpcenterResults.map((result, i) => {
      return (
        <StyledExternalLink key={i} href={result.html_url}>
          {result.title}
        </StyledExternalLink>
      );
    });
  },

  render() {
    let docsResults = this.renderDocsResults();
    let helpcenterResults = this.renderHelpCenterResults();
    let results = helpcenterResults.concat(docsResults);
    let hasResults = results && results.length > 0;

    return (
      <StyledAssistantContainer hasResults={hasResults}>
        <StyledAssistantInputRow>
          <CueIcon />
          <StyledSearchContainer>
            <StyledSearchIcon src="icon-search" />
            <StyledInput
              type="text"
              placeholder={t('Search FAQs and docs...')}
              onChange={this.handleChange}
              value={this.state.inputVal}
              autoFocus
            />
            <div
              className="close-button"
              onClick={this.props.onClose}
              style={{display: 'flex'}}
            >
              <CloseIcon />
            </div>
          </StyledSearchContainer>
        </StyledAssistantInputRow>
        {hasResults && <StyledResults>{results}</StyledResults>}
        {HookStore.get('assistant:support-button').map(cb => cb(this.state.inputVal))}
      </StyledAssistantContainer>
    );
  },
});

const StyledAssistantContainer = styled(AssistantContainer)`
  display: flex;
  flex-direction: column;
  transition: 0.1s height;
  ${p => (p.hasResults ? 'height: 300px' : '')};
`;

const StyledAssistantInputRow = styled('div')`
  display: flex;
  align-items: center;
`;

const StyledInput = styled(Input)`
  padding: 0.25em 0.25em 0.25em 1em;
  height: 2em;
  flex-grow: 1;
  text-indent: 1em;
  border-top-left-radius: 1.45rem;
  border-bottom-left-radius: 1.45rem;

  &:focus {
    border-color: ${p => p.theme.borderLight};
  }
`;

const StyledSearchIcon = styled(InlineSvg)`
  left: 0.75em;
  position: absolute;
  top: 53%; /* this is an optics thing */
  transform: translateY(-50%);
  color: ${p => p.theme.gray1};
`;

const StyledSearchContainer = styled('div')`
  position: relative;
  margin-left: 0.5em;
  display: flex;
  align-items: center;
  flex-grow: 1;
`;

const StyledResults = styled('div')`
  flex-grow: 1;
  flex-basis: 0;
  overflow: scroll;
  border-bottom-left-radius: 1.45em;
  border-bottom-right-radius: 1.45em;
`;

const StyledExternalLink = styled(ExternalLink)`
  color: ${p => p.theme.gray4};
  display: block;
  font-size: 0.875;
  padding: 0.5em 1em;

  &:not(:last-of-type) {
    border-bottom: 1px solid ${p => p.theme.borderLight};
  }
`;

export default SupportDrawer;
