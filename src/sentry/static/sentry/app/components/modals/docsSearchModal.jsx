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
      <Body>
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
                  <SearchResultWrapper type={type}>
                    <span className="title">{result.title}</span>
                    <p>{path}</p>
                  </SearchResultWrapper>
                </a>
              );
            }
            return (
              <a href={result.html_url}>
                <SearchResultWrapper type={type}>
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
  padding: 8px 14px 8px 70px;
  cursor: pointer;

  &:before {
    position: absolute;
    left: 15px;
    top: 50%;
    transform: translateY(-50%);
    padding: 4px;
    color: darkgrey;
    width: 40px;
    height: 20px;
    background: 0 0;
    border: 1px solid;
    border-radius: 9px;
    text-align: center;
    font-size: 11px;
    line-height: 1;
    content: ${p => (p.type == 'docs' ? "'Docs'" : "'Q&A'")};
  }

  p {
    margin: 2px 0 0;
    font-size: 13px;
    color: @gray-light;
    line-height: 1;
  }

  .title {
    font-weight: bold;
  }

  a {
    color: black;
  }

  .divider {
    opacity: 0.45 !important;
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
