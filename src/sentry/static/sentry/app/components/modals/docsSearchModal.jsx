import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';
import {flatMap} from 'lodash';

import {t} from 'app/locale';
import Search from 'app/components/search';
import DocsSource from 'app/components/search/sources/docsSource';
import FaqSource from 'app/components/search/sources/faqSource';

const dropdownStyle = css`
  list-style: none;
  margin-bottom: 0;
  width: 100%;
  border: none;
  position: initial;
  box-shadow: none;
`;

class DocsSearchModal extends React.Component {
  static propTypes = {
    Body: PropTypes.oneOfType([PropTypes.func, PropTypes.node]).isRequired,
  };

  render() {
    let {Body} = this.props;

    return (
      <Body className="support-search">
        <Search
          {...this.props}
          sources={[DocsSource, FaqSource]}
          entryPoint="sidebar_help"
          minSearch={3}
          maxResults={10}
          dropdownStyle={dropdownStyle}
          closeOnSelect={false}
          renderInput={({getInputProps}) => (
            <InputWrapper>
              <Input
                autoFocus
                innerRef={ref => (this.searchInput = ref)}
                {...getInputProps({
                  type: 'text',
                  placeholder: t('Search for Docs and FAQs...'),
                })}
              />
            </InputWrapper>
          )}
          renderItem={({item}) => {
            let {result, type} = item;
            if (type === 'docs') {
              let link = `https://docs.sentry.io/${result.path}/`;
              let path = flatMap(result.path.split(/[#\/]/), part => [
                part,
                <span className="divider" key={part}>
                  {' '}
                  &gt;&gt;{' '}
                </span>,
              ]);
              path.pop();
              return (
                <a href={link}>
                  <SearchResultWrapper className="search-tag search-tag-docs search-autocomplete-item">
                    <span className="title">{result.title}</span>
                    <p>{path}</p>
                  </SearchResultWrapper>
                </a>
              );
            }
            return (
              <a href={result.html_url}>
                <SearchResultWrapper className="search-tag search-tag-qa search-autocomplete-item">
                  <span className="title">{result.title}</span>
                </SearchResultWrapper>
              </a>
            );
          }}
        />
      </Body>
    );
  }
}

export default DocsSearchModal;

const SearchResultWrapper = styled('li')`
  position: relative;
  padding: 8px 14px 8px 40px;
  cursor: pointer;

  p {
    margin: 2px 0 0;
    font-size: 13px;
    color: @gray-light;
    line-height: 1;
  }
`;

const InputWrapper = styled('div')`
  padding: 2px;
`;

const Input = styled('input')`
  width: 100%;
  padding: 8px;
  border: none;
  border-radius: 8px;
  outline: none;

  &:focus {
    outline: none;
  }
`;
