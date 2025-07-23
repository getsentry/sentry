import {Fragment, useCallback, useEffect, useState} from 'react';
import debounce from 'lodash/debounce';

import {t} from 'sentry/locale';
import * as Storybook from 'sentry/stories';
import {useCompactSelectOptionsCache} from 'sentry/views/insights/common/utils/useCompactSelectOptionsCache';

const countryNameToCode = {
  Bangladesh: 'BD',
  Belgium: 'BE',
  'Burkina Faso': 'BF',
  Bulgaria: 'BG',
  'Bosnia and Herzegovina': 'BA',
  Barbados: 'BB',
  'Wallis and Futuna': 'WF',
  'Saint Barthelemy': 'BL',
  Bermuda: 'BM',
  Brunei: 'BN',
  Bolivia: 'BO',
  Bahrain: 'BH',
  Burundi: 'BI',
  Benin: 'BJ',
  Bhutan: 'BT',
  Jamaica: 'JM',
  'Bouvet Island': 'BV',
  Botswana: 'BW',
  Samoa: 'WS',
  'Bonaire, Saint Eustatius and Saba ': 'BQ',
  Brazil: 'BR',
  Bahamas: 'BS',
  Jersey: 'JE',
  Belarus: 'BY',
  Belize: 'BZ',
  Russia: 'RU',
  Rwanda: 'RW',
  Serbia: 'RS',
  'East Timor': 'TL',
  Reunion: 'RE',
  Turkmenistan: 'TM',
  Tajikistan: 'TJ',
  Romania: 'RO',
  Tokelau: 'TK',
  'Guinea-Bissau': 'GW',
  Guam: 'GU',
  Guatemala: 'GT',
  'South Georgia and the South Sandwich Islands': 'GS',
  Greece: 'GR',
  'Equatorial Guinea': 'GQ',
  Guadeloupe: 'GP',
  Japan: 'JP',
  Guyana: 'GY',
  Guernsey: 'GG',
  'French Guiana': 'GF',
  Georgia: 'GE',
  Grenada: 'GD',
  'United Kingdom': 'GB',
  Gabon: 'GA',
  'El Salvador': 'SV',
  Guinea: 'GN',
  Gambia: 'GM',
  Greenland: 'GL',
  Gibraltar: 'GI',
  Ghana: 'GH',
  Oman: 'OM',
  Tunisia: 'TN',
  Jordan: 'JO',
  Croatia: 'HR',
  Haiti: 'HT',
  Hungary: 'HU',
  'Hong Kong': 'HK',
  Honduras: 'HN',
  'Heard Island and McDonald Islands': 'HM',
  Venezuela: 'VE',
  'Puerto Rico': 'PR',
  'Palestinian Territory': 'PS',
  Palau: 'PW',
  Portugal: 'PT',
  'Svalbard and Jan Mayen': 'SJ',
  Paraguay: 'PY',
  Iraq: 'IQ',
  Panama: 'PA',
  'French Polynesia': 'PF',
  'Papua New Guinea': 'PG',
  Peru: 'PE',
  Pakistan: 'PK',
  Philippines: 'PH',
  Pitcairn: 'PN',
  Poland: 'PL',
  'Saint Pierre and Miquelon': 'PM',
  Zambia: 'ZM',
  'Western Sahara': 'EH',
  Estonia: 'EE',
  Egypt: 'EG',
  'South Africa': 'ZA',
  Ecuador: 'EC',
  Italy: 'IT',
  Vietnam: 'VN',
  'Solomon Islands': 'SB',
  Ethiopia: 'ET',
  Somalia: 'SO',
  Zimbabwe: 'ZW',
  'Saudi Arabia': 'SA',
  Spain: 'ES',
  Eritrea: 'ER',
  Montenegro: 'ME',
  Moldova: 'MD',
  Madagascar: 'MG',
  'Saint Martin': 'MF',
  Morocco: 'MA',
  Monaco: 'MC',
  Uzbekistan: 'UZ',
  Myanmar: 'MM',
  Mali: 'ML',
  Macao: 'MO',
  Mongolia: 'MN',
  'Marshall Islands': 'MH',
  Macedonia: 'MK',
  Mauritius: 'MU',
  Malta: 'MT',
  Malawi: 'MW',
  Maldives: 'MV',
  Martinique: 'MQ',
  'Northern Mariana Islands': 'MP',
  Montserrat: 'MS',
  Mauritania: 'MR',
  'Isle of Man': 'IM',
  Uganda: 'UG',
  Tanzania: 'TZ',
  Malaysia: 'MY',
  Mexico: 'MX',
  Israel: 'IL',
  France: 'FR',
  'British Indian Ocean Territory': 'IO',
  'Saint Helena': 'SH',
  Finland: 'FI',
  Fiji: 'FJ',
  'Falkland Islands': 'FK',
  Micronesia: 'FM',
  'Faroe Islands': 'FO',
  Nicaragua: 'NI',
  Netherlands: 'NL',
  Norway: 'NO',
  Namibia: 'NA',
  Vanuatu: 'VU',
  'New Caledonia': 'NC',
  Niger: 'NE',
  'Norfolk Island': 'NF',
  Nigeria: 'NG',
  'New Zealand': 'NZ',
  Nepal: 'NP',
  Nauru: 'NR',
  Niue: 'NU',
  'Cook Islands': 'CK',
  Kosovo: 'XK',
  'Ivory Coast': 'CI',
  Switzerland: 'CH',
  Colombia: 'CO',
  China: 'CN',
  Cameroon: 'CM',
  Chile: 'CL',
  'Cocos Islands': 'CC',
  Canada: 'CA',
  'Republic of the Congo': 'CG',
  'Central African Republic': 'CF',
  'Democratic Republic of the Congo': 'CD',
  'Czech Republic': 'CZ',
  Cyprus: 'CY',
  'Christmas Island': 'CX',
  'Costa Rica': 'CR',
  Curacao: 'CW',
  'Cape Verde': 'CV',
  Cuba: 'CU',
  Swaziland: 'SZ',
  Syria: 'SY',
  'Sint Maarten': 'SX',
  Kyrgyzstan: 'KG',
  Kenya: 'KE',
  'South Sudan': 'SS',
  Suriname: 'SR',
  Kiribati: 'KI',
  Cambodia: 'KH',
  'Saint Kitts and Nevis': 'KN',
  Comoros: 'KM',
  'Sao Tome and Principe': 'ST',
  Slovakia: 'SK',
  'South Korea': 'KR',
  Slovenia: 'SI',
  'North Korea': 'KP',
  Kuwait: 'KW',
  Senegal: 'SN',
  'San Marino': 'SM',
  'Sierra Leone': 'SL',
  Seychelles: 'SC',
  Kazakhstan: 'KZ',
  'Cayman Islands': 'KY',
  Singapore: 'SG',
  Sweden: 'SE',
  Sudan: 'SD',
  'Dominican Republic': 'DO',
  Dominica: 'DM',
  Djibouti: 'DJ',
  Denmark: 'DK',
  'British Virgin Islands': 'VG',
  Germany: 'DE',
  Yemen: 'YE',
  Algeria: 'DZ',
  'United States': 'US',
  Uruguay: 'UY',
  Mayotte: 'YT',
  'United States Minor Outlying Islands': 'UM',
  Lebanon: 'LB',
  'Saint Lucia': 'LC',
  Laos: 'LA',
  Tuvalu: 'TV',
  Taiwan: 'TW',
  'Trinidad and Tobago': 'TT',
  Turkey: 'TR',
  'Sri Lanka': 'LK',
  Liechtenstein: 'LI',
  Latvia: 'LV',
  Tonga: 'TO',
  Lithuania: 'LT',
  Luxembourg: 'LU',
  Liberia: 'LR',
  Lesotho: 'LS',
  Thailand: 'TH',
  'French Southern Territories': 'TF',
  Togo: 'TG',
  Chad: 'TD',
  'Turks and Caicos Islands': 'TC',
  Libya: 'LY',
  Vatican: 'VA',
  'Saint Vincent and the Grenadines': 'VC',
  'United Arab Emirates': 'AE',
  Andorra: 'AD',
  'Antigua and Barbuda': 'AG',
  Afghanistan: 'AF',
  Anguilla: 'AI',
  'U.S. Virgin Islands': 'VI',
  Iceland: 'IS',
  Iran: 'IR',
  Armenia: 'AM',
  Albania: 'AL',
  Angola: 'AO',
  Antarctica: 'AQ',
  'American Samoa': 'AS',
  Argentina: 'AR',
  Australia: 'AU',
  Austria: 'AT',
  Aruba: 'AW',
  India: 'IN',
  'Aland Islands': 'AX',
  Azerbaijan: 'AZ',
  Ireland: 'IE',
  Indonesia: 'ID',
  Ukraine: 'UA',
  Qatar: 'QA',
  Mozambique: 'MZ',
} as const;

import {CompactSelect} from './';

export default Storybook.story('CompactSelect', story => {
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

    const handleValueChange = (newValue: any) => {
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

    const handleValueChange = (newValues: any) => {
      setValues(newValues.map((value: any) => value.value));
    };

    return (
      <Fragment>
        <p>
          <code>CompactSelect</code> can also be made searchable, clearable,
          multi-selectable, etc. It's also possible to group items into sections, and set
          the props for the trigger.
        </p>

        <Storybook.Grid>
          <CompactSelect
            size="md"
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
          <CompactSelect
            size="sm"
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
          <CompactSelect
            size="xs"
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
        </Storybook.Grid>
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

  story('Virtualization', () => {
    const [value, setValue] = useState<string>('');
    const [virtualizationThreshold, setVirtualizationThreshold] = useState<number>(100);

    // Generate a large list of options to demonstrate virtualization
    const generateLargeOptionsList = (count: number) => {
      return Array.from({length: count}, (_, index) => ({
        value: `item-${index}`,
        label: `Item ${index + 1}`,
        details: `Option details for item ${index + 1}`,
      }));
    };

    const smallOptions = generateLargeOptionsList(50);
    const mediumOptions = generateLargeOptionsList(150);
    const largeOptions = generateLargeOptionsList(500);
    const extraLargeOptions = generateLargeOptionsList(1000);

    const handleValueChange = (newValue: any) => {
      setValue(newValue.value);
    };

    return (
      <Fragment>
        <p>
          <code>CompactSelect</code> supports automatic virtualization for large dropdown
          lists using <code>@tanstack/react-virtual</code>. This improves performance by
          only rendering visible items in the DOM when the list exceeds a certain threshold
          (default: 100 items).
        </p>
        
        <p>
          You can customize the virtualization threshold using the{' '}
          <code>virtualizationThreshold</code> prop. When a list has fewer items than the
          threshold, it renders normally. When it exceeds the threshold, virtualization
          kicks in automatically.
        </p>

        <div style={{marginBottom: '1rem'}}>
          <label style={{display: 'block', marginBottom: '0.5rem'}}>
            Virtualization Threshold: {virtualizationThreshold} items
          </label>
          <input
            type="range"
            min="50"
            max="200"
            step="25"
            value={virtualizationThreshold}
            onChange={(e) => setVirtualizationThreshold(Number(e.target.value))}
            style={{width: '300px'}}
          />
        </div>

        <Storybook.Grid columns={2}>
          <div>
            <h4>50 Items (Non-virtualized)</h4>
            <CompactSelect
              value={value}
              onChange={handleValueChange}
              options={smallOptions}
              searchable
              menuTitle="50 Items"
              virtualizationThreshold={virtualizationThreshold}
            />
          </div>

          <div>
            <h4>150 Items (Potentially virtualized)</h4>
            <CompactSelect
              value={value}
              onChange={handleValueChange}
              options={mediumOptions}
              searchable
              menuTitle="150 Items"
              virtualizationThreshold={virtualizationThreshold}
            />
          </div>

          <div>
            <h4>500 Items (Virtualized)</h4>
            <CompactSelect
              value={value}
              onChange={handleValueChange}
              options={largeOptions}
              searchable
              menuTitle="500 Items"
              virtualizationThreshold={virtualizationThreshold}
            />
          </div>

          <div>
            <h4>1000 Items (Virtualized)</h4>
            <CompactSelect
              value={value}
              onChange={handleValueChange}
              options={extraLargeOptions}
              searchable
              menuTitle="1000 Items"
              virtualizationThreshold={virtualizationThreshold}
            />
          </div>
        </Storybook.Grid>

        <p>
          <strong>Performance Note:</strong> Virtualized lists have a fixed height 
          (300px by default) and only render visible items plus a small overscan buffer. 
          You can see the performance difference by opening the browser dev tools and 
          comparing DOM node counts between virtualized and non-virtualized lists.
        </p>
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
