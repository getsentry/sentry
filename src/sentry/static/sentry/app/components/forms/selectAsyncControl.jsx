import debounce from 'lodash/debounce';
import PropTypes from 'prop-types';
import * as React from 'react';

import {t} from 'app/locale';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import handleXhrErrorResponse from 'app/utils/handleXhrErrorResponse';

import SelectControl from './selectControl';

/**
 * Performs an API request to `url` when menu is initially opened
 */
class SelectAsyncControl extends React.Component {
  static propTypes = {
    forwardedRef: PropTypes.any,
    /**
     * API endpoint URL
     */
    url: PropTypes.string.isRequired,

    /**
     * Parses the results of API call for the select component
     */
    onResults: PropTypes.func,

    /**
     * Additional query parameters when sending API request
     */
    onQuery: PropTypes.func,

    value: PropTypes.any,
  };

  static defaultProps = {
    placeholder: '--',
  };

  constructor(props) {
    super(props);
    this.api = new Client();
    this.state = {
      query: '',
    };
    this.cache = {};
  }

  componentWillUnmount() {
    if (!this.api) {
      return;
    }
    this.api.clear();
    this.api = null;
  }

  doQuery = debounce(cb => {
    const {url, onQuery} = this.props;
    const {query} = this.state;

    if (!this.api) {
      return null;
    }

    return this.api
      .requestPromise(url, {
        query: typeof onQuery === 'function' ? onQuery(query) : {query},
      })
      .then(
        data => cb(null, data),
        err => cb(err)
      );
  }, 250);

  handleLoadOptions = () =>
    new Promise((resolve, reject) => {
      this.doQuery((err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    }).then(
      resp => {
        const {onResults} = this.props;

        // Note `SelectControl` expects this data type:
        // {
        //   options: [{ label, value}],
        // }
        return {
          options: typeof onResults === 'function' ? onResults(resp) : resp,
        };
      },
      err => {
        addErrorMessage(t('There was a problem with the request.'));
        handleXhrErrorResponse('SelectAsync failed')(err);
        // eslint-disable-next-line no-console
        console.error(err);
      }
    );

  handleInputChange = query => {
    this.setState({query});
  };

  render() {
    const {value} = this.props;

    return (
      <SelectControl
        ref={this.props.forwardedRef}
        value={value}
        defaultOptions
        loadOptions={this.handleLoadOptions}
        onInputChange={this.handleInputChange}
        onClear={this.handleClear}
        async
        cache={this.cache}
        {...this.props}
      />
    );
  }
}

const forwardRef = (p, ref) => <SelectAsyncControl {...p} forwardedRef={ref} />;
forwardRef.displayName = 'SelectAsyncControl';

export default React.forwardRef(forwardRef);
