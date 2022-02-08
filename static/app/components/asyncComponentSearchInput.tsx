import * as React from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {Client, ResponseMeta} from 'sentry/api';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {isRenderFunc} from 'sentry/utils/isRenderFunc';
import Input from 'sentry/views/settings/components/forms/controls/input';

type RenderProps = {
  busy: boolean;
  defaultSearchBar: React.ReactNode;
  handleChange: (value: string) => void;
  value: string;
};

function DefaultSearchBar({
  busy,
  handleSubmit,
  className,
  placeholder,
  handleInputChange,
  query,
}: {
  busy: boolean;
  handleInputChange: React.ChangeEventHandler<HTMLInputElement>;
  handleSubmit: React.FormEventHandler<HTMLFormElement>;
  placeholder: string;
  query: string;
  className?: string;
}): React.ReactElement {
  return (
    <Form onSubmit={handleSubmit}>
      <Input
        value={query}
        onChange={handleInputChange}
        className={className}
        placeholder={placeholder}
      />
      {busy ? <StyledLoadingIndicator size={18} hideMessage mini /> : null}
    </Form>
  );
}

export interface AsyncComponentSearchInputProps extends WithRouterProps {
  // optional, otherwise app/views/settings/organizationMembers/organizationMembersList.tsx L:191 is not happy
  api: Client;
  onError: () => void;

  onSuccess: (data: object, resp: ResponseMeta | undefined) => void;
  /**
   * Placeholder text in the search input
   */
  placeholder: string;
  /**
   * URL to make the search request to
   */
  url: string;
  /**
   * A render-prop child may be passed to handle custom rendering of the input.
   */
  children?: (otps: RenderProps) => React.ReactElement;

  className?: string;
  /**
   * Time in milliseconds to wait before firing off the request
   */
  debounceWait?: number;
  onSearchSubmit?: (query: string, event: React.FormEvent) => void;

  /**
   * Updates URL with search query in the URL param: `query`
   */
  updateRoute?: boolean;
}

function AsyncComponentSearchInput({
  placeholder = t('Search...'),
  debounceWait = 200,
  api,
  className,
  url,
  updateRoute,
  onSearchSubmit,
  onSuccess,
  onError,
  router,
  location,
  children,
}: AsyncComponentSearchInputProps): React.ReactElement {
  const [state, setState] = React.useState<{busy: boolean; query: string}>({
    query: '',
    busy: false,
  });

  // We need to use a mutable ref to keep reference to our latest query, else
  // useCallback scope will always reference the previous value and our condition will always fail
  const latestQuery = React.useRef<string>(state.query);

  const queryResolver = React.useCallback(
    (searchQuery: string) => {
      setState({query: searchQuery, busy: true});

      api
        .requestPromise(url, {
          includeAllArgs: true,
          method: 'GET',
          query: {...location.query, query: searchQuery},
        })
        .then(([data, , resp]) => {
          if (latestQuery.current === searchQuery) {
            onSuccess(data, resp);
          }
        })
        .catch(() => {
          if (latestQuery.current === searchQuery) {
            onError();
          }
        })
        .finally(() => {
          if (latestQuery.current === searchQuery) {
            setState({query: searchQuery, busy: false});
          }
        });
    },
    [onSuccess, onError, api, url]
  );

  const debouncedQueryResolver = React.useMemo(() => {
    return debounce(queryResolver, debounceWait);
  }, [queryResolver, debounceWait]);

  const handleChange = React.useCallback(
    (searchQuery: string) => {
      latestQuery.current = searchQuery;
      debouncedQueryResolver(searchQuery);
      // We need to immediately set state to the new query value because the handler is debounced
      // and the input value is controlled, meaning that typing wouldnt be reflected in the UI
      setState({query: searchQuery, busy: state.busy});
    },
    [debouncedQueryResolver, state.busy]
  );

  const handleInputChange = React.useCallback(
    (evt: React.ChangeEvent<HTMLInputElement>) => {
      handleChange(evt.target.value);
    },
    [handleChange]
  );

  /**
   * This is called when "Enter" (more specifically a form "submit" event) is pressed.
   */
  const handleSubmit = React.useCallback(
    (evt: React.FormEvent<HTMLFormElement>) => {
      evt.preventDefault();

      // Update the URL to reflect search term.
      if (updateRoute) {
        router.push({
          pathname: location.pathname,
          query: {
            query: latestQuery.current,
          },
        });
      }

      if (typeof onSearchSubmit === 'function') {
        onSearchSubmit(latestQuery.current, evt);
      }
    },
    [router, location.pathname, updateRoute]
  );

  if (isRenderFunc<RenderProps>(children)) {
    return children({
      defaultSearchBar: (
        <DefaultSearchBar
          busy={state.busy}
          query={state.query}
          handleSubmit={handleSubmit}
          handleInputChange={handleInputChange}
          className={className}
          placeholder={placeholder}
        />
      ),
      busy: state.busy,
      value: state.query,
      handleChange,
    });
  }

  return (
    <DefaultSearchBar
      busy={state.busy}
      query={state.query}
      handleSubmit={handleSubmit}
      handleInputChange={handleInputChange}
      className={className}
      placeholder={placeholder}
    />
  );
}

/**
 * This is a search input that can be easily used in AsyncComponent/Views.
 *
 * It probably doesn't make too much sense outside of an AsyncComponent at the moment.
 */

const StyledLoadingIndicator = styled(LoadingIndicator)`
  position: absolute;
  right: 25px;
  top: 50%;
  transform: translateY(-13px);
`;

const Form = styled('form')`
  position: relative;
`;

const AsyncComponentSearchInputWithRouter = withRouter(AsyncComponentSearchInput);
export {AsyncComponentSearchInputWithRouter as AsyncComponentSearchInput};
