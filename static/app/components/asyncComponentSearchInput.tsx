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
  handleSearch,
  className,
  placeholder,
  handleInputChange,
  query,
}): React.ReactElement {
  return (
    <Form onSubmit={handleSearch}>
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

interface AsyncComponentSearchInputProps extends WithRouterProps {
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
  const [{busy, query}, setState] = React.useState<{busy: boolean; query: string}>({
    query: '',
    busy: false,
  });

  const queryResolver = React.useCallback(async (searchQuery: string) => {
    setState({busy: true, query});

    try {
      const [data, , resp] = await api.requestPromise(`${url}`, {
        includeAllArgs: true,
        method: 'GET',
        query: {...location.query, query: searchQuery},
      });
      // only update data if the request's query matches the current query
      if (query === searchQuery) {
        onSuccess(data, resp);
      }
    } catch {
      onError();
    }

    setState({busy: false, query: searchQuery});
  }, []);

  const debouncedQueryResolver = React.useMemo(() => {
    return debounce(queryResolver, debounceWait);
  }, [queryResolver, debounceWait]);

  const handleChange = React.useCallback((searchQuery: string) => {
    debouncedQueryResolver(searchQuery);
  }, []);

  const handleInputChange = React.useCallback(
    (evt: React.ChangeEvent<HTMLInputElement>) => {
      debouncedQueryResolver(evt.target.value);
    },
    [handleChange]
  );

  /**
   * This is called when "Enter" (more specifically a form "submit" event) is pressed.
   */
  function handleSearch(evt: React.FormEvent<HTMLFormElement>) {
    evt.preventDefault();

    // Update the URL to reflect search term.
    if (updateRoute) {
      router.push({
        pathname: location.pathname,
        query: {
          query,
        },
      });
    }

    if (typeof onSearchSubmit !== 'function') {
      return;
    }
    onSearchSubmit(query, evt);
  }

  if (isRenderFunc<RenderProps>(children)) {
    return children({
      defaultSearchBar: (
        <DefaultSearchBar
          busy={busy}
          handleSearch={handleSearch}
          query={query}
          handleInputChange={handleInputChange}
          className={className}
          placeholder={placeholder}
        />
      ),
      busy,
      value: query,
      handleChange,
    });
  }

  return (
    <DefaultSearchBar
      busy={busy}
      handleSearch={handleSearch}
      query={query}
      handleInputChange={handleInputChange}
      className={className}
      placeholder={placeholder}
    />
  );
}

/**
 * This is a search input that can be easily used in AsyncComponent/Views.
 *
 * It probably doesn't make too much sense outside of an AsyncComponent atm.
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

export default withRouter(AsyncComponentSearchInput);
