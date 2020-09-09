import React from 'react';
import styled from '@emotion/styled';
import {keyframes} from '@emotion/core';
import DOMPurify from 'dompurify';
import {SentryGlobalSearch, standardSDKSlug} from 'sentry-global-search';

import LoadingIndicator from 'app/components/loadingIndicator';
import space from 'app/styles/space';
import theme from 'app/utils/theme';

const search = new SentryGlobalSearch(['docs', 'help-center', 'develop', 'blog']);

type Hit = {
  id: string;
  url: string;
  title?: string;
  text?: string;
  context?: {
    context1?: string;
    context2?: string;
  };
};

type Result = {
  site: string;
  name: string;
  hits: Hit[];
};

type State = {
  query: string;
  results: Result[];
  focus: boolean;
  loading: boolean;
};

type Props = {
  platforms?: string[];
  renderInput?: Function;
};

//
// TODO: Get platform from current project type
//

class StaticSiteSearch extends React.Component<Props, State> {
  state: State = {
    query: '',
    results: [],
    focus: false,
    loading: true,
  };

  renderInput({value, onChange, onFocus}) {
    return (
      <input
        type="search"
        placeholder="What do you need help with?"
        aria-label="Search"
        className="form-control"
        {...{value, onChange, onFocus}}
      />
    );
  }

  render() {
    const {query, results, focus, loading} = this.state;
    const {platforms = []} = this.props;
    const totalHits = results.reduce((a, x) => a + x.hits.length, 0);

    const renderInput = this.props.renderInput || this.renderInput;

    return (
      <StyledSearch>
        {renderInput({
          value: query,
          onChange: ({target: {value: newQuery}}) => {
            this.setState({query: newQuery});

            search
              .query(newQuery, {
                platforms: platforms.map(platform => standardSDKSlug(platform).slug),
              })
              .then((newResults: Result[]) => {
                this.setState({loading: false, results: newResults});
              });
          },
          onFocus: () => this.setState({focus: true}),
        })}

        {query.length > 0 && focus && (
          <div className="sgs-search-results">
            {loading && (
              <LoadingWrapper>
                <LoadingIndicator mini hideMessage relative />
              </LoadingWrapper>
            )}

            {!loading &&
              (totalHits > 0 ? (
                <React.Fragment>
                  <div className="sgs-search-results-scroll-container">
                    {results.map((result, i) => {
                      const hits = result.hits.slice(0, 10);

                      return (
                        <React.Fragment key={result.site}>
                          {i !== 0 && (
                            <h4 className="sgs-site-result-heading">
                              From {result.name}
                            </h4>
                          )}
                          <ul className={`sgs-hit-list ${i === 0 ? '' : 'sgs-offsite'}`}>
                            {hits.length > 0 ? (
                              hits.map(hit => (
                                <li key={hit.id} className="sgs-hit-item">
                                  <a href={hit.url}>
                                    {hit.title && (
                                      <h6>
                                        <span
                                          dangerouslySetInnerHTML={{
                                            __html: DOMPurify.sanitize(hit.title, {
                                              ALLOWED_TAGS: ['mark'],
                                            }),
                                          }}
                                        />
                                      </h6>
                                    )}
                                    {hit.text && (
                                      <span
                                        dangerouslySetInnerHTML={{
                                          __html: DOMPurify.sanitize(hit.text, {
                                            ALLOWED_TAGS: ['mark'],
                                          }),
                                        }}
                                      />
                                    )}
                                    {hit.context && (
                                      <div className="sgs-hit-context">
                                        {hit.context.context1 && (
                                          <div className="sgs-hit-context-left">
                                            {hit.context.context1}
                                          </div>
                                        )}
                                        {hit.context.context2 && (
                                          <div className="sgs-hit-context-right">
                                            {hit.context.context2}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </a>
                                </li>
                              ))
                            ) : (
                              <li className="sgs-hit-item sgs-hit-empty-state">
                                No results for <em>{query}</em>
                              </li>
                            )}
                          </ul>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </React.Fragment>
              ) : (
                <div className="sgs-hit-empty-state">
                  No results for <em>{query}</em>
                </div>
              ))}
            <StyledSupportLink>
              Need personalized Help? Contact our support team!
            </StyledSupportLink>
          </div>
        )}
      </StyledSearch>
    );
  }
}

//
// TODO: This should come from getsentry and only appear for paying customers
// When this is clicked, it should pop open the zendesk widget.
//
const StyledSupportLink = styled('a')`
  padding: 16px;
  text-align: center;
  font-size: 16px;
  font-weight: bold;
  color: ${theme.pink400};
  border-top: 1px solid ${theme.gray200};

  &:hover {
    color: ${theme.pink400};
  }
`;

const stroke = keyframes`
  10% {
    stroke-dashoffset: 0;
  }
  90%,
  100% {
    stroke-dashoffset: 281;
  }
`;

const spin = keyframes`
  40% {
      transform: rotate3d(0, 0, 0, 0deg);
  }
  45% {
      transform: rotate3d(0, 0, 1, -15deg);
  }
  55% {
      transform: rotate3d(0, 0, 1, 375deg);
  }
  60%,
  100% {
      transform: rotate3d(0, 0, 1, 360deg);
  }
`;

const StyledSearch = styled('div')`
  input.form-control {
    width: 100%;
    padding: 12px;
    border: none;
    border-radius: 8px;
    outline: none;
    font-size: 16px;

    &:focus {
      outline: none;
    }
  }

  .sgs-search-results {
    position: absolute;
    margin-top: 8px;
    z-index: 5;
    border: 4px solid ${theme.purple500};
    border-radius: 8px;
    background-color: ${theme.white};
    font-size: 14px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    width: 100%;

    .logo {
      margin: 12px 0 8px;
      color: ${theme.purple500};
      width: 48px;
      position: relative;
      left: 50%;
      transform: translateX(-50%);
    }
  }

  .sgs-search-results-scroll-container {
    flex: 1;
    overflow: auto;
  }

  .sgs-site-result-heading {
    background-color: ${theme.purple500};
    color: ${theme.white};
    padding: 8px 16px;
    font-size: 14px;
    font-weight: normal;
    margin-bottom: 0;
  }

  .sgs-hit-list {
    list-style: none;
    margin: 0;
    padding: 4px;

    &.sgs-offsite {
      background-color: ${theme.gray200};

      .sgs-hit-item > a:hover {
        background-color: ${theme.white};
      }
    }
  }

  .sgs-hit-item {
    mark {
      color: ${theme.pink400};
      background: inherit;
      padding: 0;
    }

    h6 {
      margin-top: 0;
      margin-bottom: 4px;
      font-size: 14px;
      color: ${theme.textColor};
    }

    a {
      display: block;
      text-decoration: none;
      color: ${theme.textColor};
      border-radius: ${theme.borderRadius};

      padding: 12px;
      line-height: 1.5;

      &:hover {
        background-color: ${theme.gray200};
      }
    }
  }

  .sgs-hit-empty-state {
    display: block;
    text-decoration: none;
    color: ${theme.textColor};
    padding: 12px;
    line-height: 1.5;
  }

  .sgs-hit-context {
    margin-top: 4px;
    display: flex;
    font-size: 12px;
    color: ${theme.textColor};

    .sgs-hit-context-left {
      font-style: italic;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      direction: rtl;
      padding-right: 4px;
      flex: 1;
    }

    .sgs-hit-context-right {
      flex: 0;
    }
  }

  .sgs-expand-results {
    flex: 0;
    margin: 4px 4px 8px;
  }

  .sgs-expand-results-button {
    display: block;
    border: 0;
    background-color: ${theme.gray200};
    border-radius: 3px;
    padding: 4px 12px;
    width: 100%;
    text-align: left;
    box-sizing: border-box;
    font-weight: bold;
    color: ${theme.textColor};
    line-height: 28px;
  }

  .loader-stroke {
    stroke-dasharray: 282;
    stroke-dashoffset: 0;
  }

  .loading .loader-stroke {
    animation: ${stroke} 2s cubic-bezier(0.85, 0, 0.1, 1) infinite alternate;
  }

  .loader-spin {
    transform: rotate3d(0, 0, 0, 0deg);
    transform-origin: 42.5px 51%;
    transform-style: preserve-3D;
  }

  .loading .loader-spin {
    animation: ${spin} 4s 1.8s ease-in-out infinite;
  }
`;

const LoadingWrapper = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: ${space(1)};
`;

export default StaticSiteSearch;
