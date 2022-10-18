import {Component, forwardRef} from 'react';
import ReactSelect from 'react-select';
import debounce from 'lodash/debounce';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';

import SelectControl, {ControlProps, GeneralSelectValue} from './selectControl';

export type Result = {
  label: string;
  value: string;
};

export interface SelectAsyncControlProps {
  forwardedRef: React.Ref<ReactSelect<GeneralSelectValue>>;
  // TODO(ts): Improve data type
  onQuery: (query: string | undefined) => {};
  onResults: (data: any) => Result[];
  url: string;
  value: ControlProps['value'];
  defaultOptions?: boolean | GeneralSelectValue[];
}

type State = {
  query?: string;
};

/**
 * Performs an API request to `url` to fetch the options
 */
class SelectAsyncControl extends Component<SelectAsyncControlProps> {
  static defaultProps = {
    placeholder: '--',
    defaultOptions: true,
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
    const {value, forwardedRef, defaultOptions, ...props} = this.props;
    return (
      <SelectControl
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

const RefForwarder = (p, ref) => <SelectAsyncControl {...p} forwardedRef={ref} />;
RefForwarder.displayName = 'SelectAsyncControl';

export default forwardRef(RefForwarder);
