import React from 'react';
import debounce from 'lodash/debounce';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import {t} from 'app/locale';
import handleXhrErrorResponse from 'app/utils/handleXhrErrorResponse';

import SelectControl, {ControlProps} from './selectControl';

type Result = {
  value: string;
  label: string;
};

type Props = {
  url: string;
  onResults: (data: any) => Result[]; //TODO(ts): Improve data type
  onQuery: (query: string | undefined) => {};
} & Pick<ControlProps, 'value' | 'forwardedRef'>;

type State = {
  query?: string;
};

/**
 * Performs an API request to `url` when menu is initially opened
 */
class SelectAsyncControl extends React.Component<Props> {
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

  state: State = {};

  componentWillUnmount() {
    if (!this.api) {
      return;
    }
    this.api.clear();
    this.api = null;
  }

  api: Client | null;
  cache: Record<string, any>;

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
        return typeof onResults === 'function' ? onResults(resp) : resp;
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
    const {value, forwardedRef, ...props} = this.props;

    return (
      <SelectControl
        ref={forwardedRef}
        value={value}
        defaultOptions
        loadOptions={this.handleLoadOptions}
        onInputChange={this.handleInputChange}
        async
        cache={this.cache}
        {...props}
      />
    );
  }
}

const forwardRef = (p, ref) => <SelectAsyncControl {...p} forwardedRef={ref} />;
forwardRef.displayName = 'SelectAsyncControl';

export default React.forwardRef(forwardRef);
