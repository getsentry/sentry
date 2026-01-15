import {Fragment, useCallback, useEffect, useState} from 'react';
import debounce from 'lodash/debounce';

import {Heading} from '@sentry/scraps/text';

import {IconSiren} from 'sentry/icons';
import {t} from 'sentry/locale';
import * as Storybook from 'sentry/stories';
import {useCompactSelectOptionsCache} from 'sentry/views/insights/common/utils/useCompactSelectOptionsCache';

import {SelectTrigger} from './trigger';
import {CompactSelect} from './';

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
    const [value, setValue] = useState<string>();
    const options = [
      {value: '', label: 'All'},
      {value: '2', label: '2XX', details: 'Optional'},
      {value: '3', label: '3XX', details: 'Optional'},
      {value: '4', label: '4XX', details: 'Optional'},
      {value: '5', label: '5XX', details: 'Optional'},
    ];

    return (
      <Fragment>
        <p>
          In the most basic case, a <code>value</code>, <code>onChange</code> handler and
          an array of <code>options</code> are all that's needed. The component does not
          maintain its own selection state.
        </p>

        <CompactSelect
          value={value}
          onChange={newValue => {
            setValue(newValue.value);
          }}
          options={options}
        />
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

  story('Custom Trigger', () => {
    const [value, setValue] = useState<string>('');
    const options = [
      {value: '1', label: '1XX', details: 'Informational Response'},
      {value: '2', label: '2XX', details: 'Successful'},
      {value: '3', label: '3XX', details: 'Redirection'},
      {value: '4', label: '4XX', details: 'Client Error'},
      {value: '5', label: '5XX', details: 'Server Error'},
    ];
    const option = options.find(opt => opt.value === value);

    return (
      <Fragment>
        <p>
          <code>CompactSelect</code> should always be triggered by a{' '}
          <code>SelectTrigger</code>. By default, it will render a{' '}
          <code>SelectTrigger.Button</code> for you, which is a{' '}
          <code>DropdownButton</code> under the hood. You can pass a custom trigger with
          the <code>trigger</code> prop.
        </p>
        <p>
          Note that <code>props</code> passed to the trigger need to be spread onto the
          underlying <code>SelectTrigger</code>. Always use a <code>SelectTrigger</code>,
          there will be type errors when you're trying to use other components.
        </p>
        <p>
          <code>SelectTrigger</code> will inherit props like <code>size</code>,{' '}
          <code>isOpen</code> and <code>disabled</code> from the{' '}
          <code>CompactSelect</code>, so you don't need to pass them manually.
        </p>

        <CompactSelect
          value={value}
          trigger={props => (
            <SelectTrigger.Button
              {...props}
              prefix="Status Code"
              priority="danger"
              icon={<IconSiren />}
            >
              {option ? `${option.label} (${option.details})` : 'None'}
            </SelectTrigger.Button>
          )}
          onChange={newValue => {
            setValue(newValue.value);
          }}
          options={options}
        />
      </Fragment>
    );
  });

  story('Virtualization', () => {
    const [value, setValue] = useState<string>('');
    const options = COUNTRY_NAMES.map(name => ({
      value: name,
      label: name,
    }));

    return (
      <Fragment>
        <p>
          <code>CompactSelect</code> can be virtualized for large lists of options. This
          improves performance when rendering large lists.
        </p>
        <p>
          To enable virtualization, set the <code>virtualizeThreshold</code> prop to the
          number of options above which virtualization should be enabled. By default,
          virtualization is enabled for lists with more than 150 options.
        </p>
        <Heading as="h3">Known Limitations</Heading>
        <p>
          Virtualization comes with some limitations. Currently, it does not support items
          that are grouped into sections, so virtualization will be disabled if sections
          are found.
        </p>
        <p>
          Additionally, since not all items are rendered to the DOM, we cannot
          automatically calculate the width of the underlying menu. To address this, we
          are trying to find out which option will be the longest to render & measure it
          when the menu is first opened. This process only looks at <code>textValue</code>{' '}
          and <code>label</code> of the option, so it might fail in cases where different{' '}
          <code>trailingItems</code> or <code>leadingItems</code> are used, or when long{' '}
          <code>details</code> are rendered. You can instead also pass a hardcoded{' '}
          <code>menuWidth</code> to <code>CompactSelect</code>.
        </p>

        <CompactSelect
          value={value}
          onChange={newValue => {
            setValue(newValue.value);
          }}
          options={options}
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
    details: 'Details',
    leadingItems: <IconSiren size="xs" />,
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
