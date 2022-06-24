import {useCallback, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {Client, ResponseMeta} from 'sentry/api';
import Input from 'sentry/components/forms/controls/input';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

type RenderProps = {
  busy: boolean;
  defaultSearchBar: React.ReactNode;
  handleChange: (value: string) => void;
  value: string;
};

type DefaultProps = {
  /**
   * Placeholder text in the search input
   */
  placeholder: string;
  /**
   * Time in milliseconds to wait before firing off the request
   */
  debounceWait?: number; // optional, otherwise app/views/settings/organizationMembers/organizationMembersList.tsx L:191 is not happy
};

type Props = DefaultProps & {
  api: Client;
  onError: () => void;
  onSuccess: (data: object, resp: ResponseMeta | undefined) => void;
  /**
   * URL to make the search request to
   */
  url: string;

  /**
   * A render-prop child may be passed to handle custom rendering of the input.
   */
  children?: (otps: RenderProps) => React.ReactNode;
  className?: string;
  onSearchSubmit?: (query: string, event: React.FormEvent) => void;

  /**
   * Updates URL with search query in the URL param: `query`
   */
  updateRoute?: boolean;
};

/**
 * This is a search input that can be easily used in AsyncComponent/Views.
 *
 * It probably doesn't make too much sense outside of an AsyncComponent atm.
 */
function AsyncComponentSearchInput({
  placeholder = t('Search...'),
  debounceWait = 200,
  ...props
}: Props) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const immediateQuery = useCallback(
    async (searchQuery: string) => {
      const {api} = props;
      setBusy(true);

      try {
        const [data, , resp] = await api.requestPromise(`${props.url}`, {
          includeAllArgs: true,
          method: 'GET',
          query: {...location.query, query: searchQuery},
        });
        // only update data if the request's query matches the current query
        if (query === searchQuery) {
          props.onSuccess(data, resp);
        }
      } catch {
        props.onError();
      }

      setBusy(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location.query, props.url]
  );

  const debouncedQuery = debounce(immediateQuery, debounceWait);

  const handleChange = (newQuery: string) => {
    debouncedQuery(newQuery);
    setQuery(newQuery);
  };

  const handleInputChange = (evt: React.ChangeEvent<HTMLInputElement>) =>
    handleChange(evt.target.value);

  /**
   * This is called when "Enter" (more specifically a form "submit" event) is pressed.
   */
  const handleSearch = useCallback(
    (evt: React.FormEvent<HTMLFormElement>) => {
      evt.preventDefault();

      // Update the URL to reflect search term.
      if (props.updateRoute) {
        // TODO(nisanthan): once react-router is updated to v6, refactor the query params
        navigate(`${location.pathname}?query=${query}`);
      }

      if (typeof props.onSearchSubmit !== 'function') {
        return;
      }
      props.onSearchSubmit(query, evt);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.updateRoute, location.pathname]
  );

  const defaultSearchBar = (
    <Form onSubmit={handleSearch}>
      <Input
        value={query}
        onChange={handleInputChange}
        className={props.className}
        placeholder={placeholder}
      />
      {busy && <StyledLoadingIndicator size={18} hideMessage mini />}
    </Form>
  );

  return props.children === undefined
    ? defaultSearchBar
    : props.children({defaultSearchBar, busy, value: query, handleChange});
}

const StyledLoadingIndicator = styled(LoadingIndicator)`
  position: absolute;
  right: 25px;
  top: 50%;
  transform: translateY(-13px);
`;

const Form = styled('form')`
  position: relative;
`;

export default AsyncComponentSearchInput;
