import {useCallback, useEffect, useState} from 'react';
import debounce from 'lodash/debounce';

import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import SelectControlWithProps from 'sentry/views/insights/browser/resources/components/selectControlWithProps';
import {useResourcePagesQuery} from 'sentry/views/insights/browser/resources/queries/useResourcePagesQuery';
import {BrowserStarfishFields} from 'sentry/views/insights/browser/resources/utils/useResourceFilters';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';

type Option = {
  label: string | React.ReactElement;
  value: string;
};

export function TransactionSelector({
  value,
  defaultResourceTypes,
}: {
  defaultResourceTypes?: string[];
  value?: string;
}) {
  const [state, setState] = useState({
    search: '',
    inputChanged: false,
    shouldRequeryOnInputChange: false,
  });
  const location = useLocation();
  const organization = useOrganization();

  const {data: pages, isLoading} = useResourcePagesQuery(
    defaultResourceTypes,
    state.search
  );

  // If the maximum number of pages is returned, we need to requery on input change to get full results
  if (!state.shouldRequeryOnInputChange && pages && pages.length >= 100) {
    setState({...state, shouldRequeryOnInputChange: true});
  }

  // Everytime loading is complete, reset the inputChanged state
  useEffect(() => {
    if (!isLoading && state.inputChanged) {
      setState({...state, inputChanged: false});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const optionsReady = !isLoading && !state.inputChanged;

  const options: Option[] = optionsReady
    ? [{value: '', label: 'All'}, ...pages.map(page => ({value: page, label: page}))]
    : [];

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debounceUpdateSearch = useCallback(
    debounce((search, currentState) => {
      setState({...currentState, search});
    }, 500),
    []
  );

  return (
    <SelectControlWithProps
      inFieldLabel={`${t('Page')}:`}
      options={options}
      value={value}
      onInputChange={input => {
        if (state.shouldRequeryOnInputChange) {
          setState({...state, inputChanged: true});
          debounceUpdateSearch(input, state);
        }
      }}
      noOptionsMessage={() => (optionsReady ? undefined : t('Loading...'))}
      onChange={newValue => {
        trackAnalytics('insight.asset.filter_by_page', {
          organization,
        });
        browserHistory.push({
          ...location,
          query: {
            ...location.query,
            [BrowserStarfishFields.TRANSACTION]: newValue?.value,
            [QueryParameterNames.SPANS_CURSOR]: undefined,
          },
        });
      }}
    />
  );
}
