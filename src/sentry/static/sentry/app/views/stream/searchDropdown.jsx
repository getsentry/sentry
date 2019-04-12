import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';

import LoadingIndicator from 'app/components/loadingIndicator';

class SearchDropdown extends React.PureComponent {
  static propTypes = {
    items: PropTypes.array.isRequired,
    searchSubstring: PropTypes.string,
    onClick: PropTypes.func.isRequired,
    loading: PropTypes.bool,
  };

  static defaultProps = {
    searchSubstring: '',
    onClick: function() {},
  };

  renderDescription = item => {
    const searchSubstring = this.props.searchSubstring;
    if (!searchSubstring) {
      return item.desc;
    }

    const text = item.desc;
    const idx = text.toLowerCase().indexOf(searchSubstring.toLowerCase());

    if (idx === -1) {
      return item.desc;
    }

    return (
      <span>
        {text.substr(0, idx)}
        <strong>{text.substr(idx, searchSubstring.length)}</strong>
        {text.substr(idx + searchSubstring.length)}
      </span>
    );
  };

  render() {
    return (
      <div className={classNames('search-dropdown', this.props.className)}>
        <ul className="search-helper search-autocomplete-list">
          {this.props.loading ? (
            <li key="loading" data-test-id="search-autocomplete-item">
              <LoadingIndicator mini={true} />
            </li>
          ) : (
            this.props.items.map(item => {
              return (
                <li
                  key={item.value || item.desc}
                  className={item.active ? 'active' : null}
                  data-test-id="search-autocomplete-item"
                  onClick={this.props.onClick.bind(this, item.value, item)}
                >
                  <span className={classNames('icon', item.className)} />
                  <h4>
                    {item.title && item.title + ' - '}
                    <span className="search-description">
                      {this.renderDescription(item)}
                    </span>
                  </h4>
                  {item.example ? <p className="search-example">{item.example}</p> : ''}
                </li>
              );
            })
          )}
        </ul>
      </div>
    );
  }
}

export default SearchDropdown;
