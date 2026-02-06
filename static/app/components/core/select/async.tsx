// we need forwardRef for class components
// eslint-disable-next-line no-restricted-syntax
import {Component, forwardRef} from 'react';
import debounce from 'lodash/debounce';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import type {ReactSelect} from 'sentry/components/forms/controls/reactSelectWrapper';
import {t} from 'sentry/locale';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import type RequestError from 'sentry/utils/requestError/requestError';

import type {ControlProps, GeneralSelectValue} from './';
import {Select} from './';

export type Result = {
  label: string | React.ReactNode;
  value: string;
};

export interface SelectAsyncControlProps<TData = any> {
  // TODO(ts): Improve data type
  onQuery: (query: string | undefined) => Record<string, unknown>;
  onResults: (data: TData) => Result[];
  url: string;
  value: ControlProps['value'];
  defaultOptions?: boolean | GeneralSelectValue[];
  forwardedRef?: React.Ref<typeof ReactSelect<GeneralSelectValue>>;
}

type State = {
  query?: string;
};

/**
 * Performs an API request to `url` to fetch the options
 */
class SelectAsyncControl<TData = unknown> extends Component<
  SelectAsyncControlProps<TData>
> {
  static defaultProps = {
    placeholder: '--',
    defaultOptions: true,
  };

  constructor(props: SelectAsyncControlProps<TData>) {
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
  cache: Record<string, unknown>;

  doQuery = debounce((cb: (...args: [RequestError] | [null, TData]) => void) => {
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
    new Promise<TData>((resolve, reject) => {
      this.doQuery((...errorOrData) => {
        if (errorOrData[0]) {
          reject(errorOrData[0]);
        } else {
          resolve(errorOrData[1]);
        }
      });
    }).then(
      resp => {
        const {onResults} = this.props;
        return typeof onResults === 'function' ? onResults(resp) : resp;
      },
      (err: RequestError) => {
        addErrorMessage(t('There was a problem with the request.'));
        handleXhrErrorResponse('SelectAsync failed', err);
        // eslint-disable-next-line no-console
        console.error(err);
      }
    );

  handleInputChange = (query: any) => {
    this.setState({query});
  };

  render() {
    const {value, forwardedRef, defaultOptions, ...props} = this.props;
    return (
      <Select
        // The key is used as a way to force a reload of the options:
        // https://github.com/JedWatson/react-select/issues/1879#issuecomment-316871520
        key={value}
        ref={forwardedRef}
        value={value}
        defaultOptions={defaultOptions}
        loadOptions={this.handleLoadOptions}
        onInputChange={this.handleInputChange}
        async
        cache={this.cache}
        {...props}
      />
    );
  }
}

export const SelectAsync = forwardRef((p: any, ref: any) => {
  return <SelectAsyncControl {...p} forwardedRef={ref} />;
});
