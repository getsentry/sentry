import {Fragment, useCallback, useEffect, useState} from 'react';
import debounce from 'lodash/debounce';

import {CompactSelect} from 'sentry/components/compactSelect';
import countryNameToCode from 'sentry/data/countryCodesMap';
import {t} from 'sentry/locale';
import storyBook from 'sentry/stories/storyBook';
import {useCompactSelectOptionsCache} from 'sentry/views/insights/common/utils/useCompactSelectOptionsCache';

export default storyBook(CompactSelect, story => {
  story('Basics', () => {
    return (
      <Fragment>
        <p>
          <code>CompactSelect</code> is a general-purpose dropdown select component. It's
          a capable alternative to <code>select</code> elements, and supports features
          like sections, search, multi-select, loading states, and more.
        </p>

        <p>
          <code>SelectControl</code> is a similar component, but is meant to be used
          inside of forms. <code>CompactSelect</code> is meant for use outside of forms.
          We use <code>CompactSelect</code> for features like project selectors,
          environment selectors, and other filter dropdowns. We use{' '}
          <code>SelectControl</code> inside forms in the Settings UI, and some other
          similar places.
        </p>
      </Fragment>
    );
  });

  story('Simple', () => {
    const [value, setValue] = useState<string>('');
    const options = [
      {value: '', label: 'All'},
      {value: '2', label: '2XX', details: 'Optional'},
      {value: '3', label: '3XX', details: 'Optional'},
      {value: '4', label: '4XX', details: 'Optional'},
      {value: '5', label: '5XX', details: 'Optional'},
    ];

    const handleValueChange = newValue => {
      setValue(newValue.value);
    };

    return (
      <Fragment>
        <p>
          In the most basic case, a <code>value</code>, <code>onChange</code> handler and
          an array of <code>options</code> are all that's needed. The component does not
          maintain its own selection state.
        </p>

        <CompactSelect value={value} onChange={handleValueChange} options={options} />
      </Fragment>
    );
  });

  story('Complicated', () => {
    const [values, setValues] = useState<string[]>(['Bo Peep', 'M-O']);
    const toyStory = ['Woody', 'Buzz', 'Sid', 'Bo Peep', 'Stinky Pete', 'Rex', 'Hamm'];

    const wallE = ['WALL-E', 'EVE', 'AUTO', 'Cpt. McCrea', 'M-O'];

    const options = [
      {
        key: 'toy-story',
        label: 'Toy Story',
        options: arrayToOptions(toyStory),
      },
      {
        key: 'wall-e',
        label: 'WALL-E',
        options: arrayToOptions(wallE),
      },
    ];

    const handleValueChange = newValues => {
      setValues(newValues.map(value => value.value));
    };

    return (
      <Fragment>
        <p>
          <code>CompactSelect</code> can also be made searchable, clearable,
          multi-selectable, etc. It's also possible to group items into sections, and set
          the props for the trigger.
        </p>

        <CompactSelect
          triggerProps={{
            prefix: t('Character'),
          }}
          value={values}
          onChange={handleValueChange}
          options={options}
          multiple
          searchable
          clearable
        />
      </Fragment>
    );
  });

  story('Caching', () => {
    const [country, setCountry] = useState<string>('');
    const [search, setSearch] = useState<string>('');
    const {data, isLoading} = useCountrySearch(search);

    const options = data.map(dataCountry => ({
      value: dataCountry,
      label: dataCountry,
    }));

    const {options: cachedOptions} = useCompactSelectOptionsCache(options);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const debouncedSetSearch = useCallback(
      debounce(newSearch => {
        setSearch(newSearch);
      }, 500),
      []
    );

    return (
      <Fragment>
        <p>
          In some cases, it's useful to add caching to <code>CompactSelect</code>. If your
          select is loading data asynchronously as the user types, a naive implementation
          will interrupt the user flow. Consider the country selector below. Try typing
          "c" then a second later "a", then "n". You'll notice that the loading state
          interrupts the flow, because it clears the options list. This happens if the
          data hook clears previous results while data is loading (very common).
        </p>
        <div>
          <CompactSelect
            loading={isLoading}
            value={country}
            options={options}
            menuTitle="Countries"
            searchable
            onSearch={newSearch => {
              debouncedSetSearch(newSearch);
            }}
            onChange={newValue => {
              setCountry(newValue.value);
            }}
          />
        </div>
        <p>
          One solution is to wrap the data in <code>useCompactSelectOptionsCache</code>.
          This will store all previously known results, which prevents the list clearing
          issue when typing forward and backspacing.
        </p>
        <div>
          <CompactSelect
            loading={isLoading}
            value={country}
            options={cachedOptions}
            menuTitle="Countries"
            searchable
            onSearch={newSearch => {
              debouncedSetSearch(newSearch);
            }}
            onChange={newValue => {
              setCountry(newValue.value.toString());
            }}
          />
        </div>
      </Fragment>
    );
  });
});

const arrayToOptions = (array: string[]) =>
  array.map(item => ({
    value: item,
    label: item,
  }));

const COUNTRY_NAMES = Object.keys(countryNameToCode).sort();

const findCountries = (prefix: string) => {
  const promise = new Promise<string[]>(resolve => {
    setTimeout(() => {
      resolve(
        COUNTRY_NAMES.filter(name =>
          name.toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase())
        )
      );
    }, 500);
  });

  return promise;
};

const useCountrySearch = (prefix: string) => {
  const [data, setData] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    setData([]);

    setIsLoading(true);
    findCountries(prefix).then(newData => {
      setIsLoading(false);
      setData(newData.slice(0, 5));
    });
  }, [prefix]);

  return {data, isLoading};
};
