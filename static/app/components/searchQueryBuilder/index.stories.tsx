import {Fragment, useState} from 'react';

import MultipleCheckbox from 'sentry/components/forms/controls/multipleCheckbox';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import {InvalidReason} from 'sentry/components/searchSyntax/parser';
import {ItemType} from 'sentry/components/smartSearchBar/types';
import JSXNode from 'sentry/components/stories/jsxNode';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import storyBook from 'sentry/stories/storyBook';
import type {TagCollection} from 'sentry/types/group';
import {
  FieldKey,
  FieldKind,
  FieldValueType,
  MobileVital,
  WebVital,
} from 'sentry/utils/fields';

const FILTER_KEYS: TagCollection = {
  [FieldKey.ASSIGNED]: {
    key: FieldKey.ASSIGNED,
    name: 'Assigned To',
    kind: FieldKind.FIELD,
    predefined: true,
    values: [
      {
        title: 'Suggested',
        type: 'header',
        icon: null,
        children: [{value: 'me'}, {value: 'unassigned'}],
      },
      {
        title: 'All',
        type: 'header',
        icon: null,
        children: [{value: 'person1@sentry.io'}, {value: 'person2@sentry.io'}],
      },
    ],
  },
  [FieldKey.BROWSER_NAME]: {
    key: FieldKey.BROWSER_NAME,
    name: 'Browser Name',
    kind: FieldKind.FIELD,
    predefined: true,
    values: ['Chrome', 'Firefox', 'Safari', 'Edge'],
  },
  [FieldKey.IS]: {
    key: FieldKey.IS,
    name: 'is',
    predefined: true,
    values: ['resolved', 'unresolved', 'ignored'],
  },
  [FieldKey.LAST_SEEN]: {
    key: FieldKey.LAST_SEEN,
    name: 'lastSeen',
    kind: FieldKind.FIELD,
  },
  [FieldKey.TIMES_SEEN]: {
    key: FieldKey.TIMES_SEEN,
    name: 'timesSeen',
    kind: FieldKind.FIELD,
  },
  [WebVital.LCP]: {
    key: WebVital.LCP,
    name: 'lcp',
    kind: FieldKind.FIELD,
  },
  [MobileVital.FRAMES_SLOW_RATE]: {
    key: MobileVital.FRAMES_SLOW_RATE,
    name: 'framesSlowRate',
    kind: FieldKind.FIELD,
  },
  custom_tag_name: {
    key: 'custom_tag_name',
    name: 'Custom_Tag_Name',
  },
};

const FITLER_KEY_SECTIONS: FilterKeySection[] = [
  {
    value: 'cat_1',
    label: 'Category 1',
    children: [
      FieldKey.ASSIGNED,
      FieldKey.BROWSER_NAME,
      FieldKey.IS,
      FieldKey.LAST_SEEN,
      FieldKey.TIMES_SEEN,
    ],
  },
  {
    value: 'cat_2',
    label: 'Category 2',
    children: [WebVital.LCP, MobileVital.FRAMES_SLOW_RATE],
  },
  {
    value: 'cat_3',
    label: 'Category 3',
    children: ['custom_tag_name'],
  },
];

const getTagValues = (): Promise<string[]> => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(['foo', 'bar', 'baz']);
    }, 500);
  });
};

export default storyBook(SearchQueryBuilder, story => {
  story('Getting started', () => {
    return (
      <Fragment>
        <p>
          <JSXNode name="SearchQueryBuilder" /> is a component which allows you to build a
          search query using a set of predefined filter keys and values.
        </p>
        <p>
          The search query, unless configured otherwise, may contain filters, logical
          operators, and free text. These filters can have defined data types, but default
          to a multi-selectable string filter.
        </p>
        <p>
          Required props:
          <ul>
            <li>
              <strong>
                <code>initialQuery</code>
              </strong>
              : The initial query to display in the search input.
            </li>
            <li>
              <strong>
                <code>filterKeys</code>
              </strong>
              : A collection of filter keys which are used to populate the dropdowns. All
              valid filter keys should be defined here.
            </li>
            <li>
              <strong>
                <code>getTagValues</code>
              </strong>
              : A function which returns an array of filter value suggestions. Any filter
              key which does not have <code>predefined: true</code> will use this function
              to get value suggestions.
            </li>
            <li>
              <strong>
                <code>searchSource</code>
              </strong>
              : Used to differentiate between different search bars for analytics.
              Typically snake_case (e.g. <code>issue_details</code>,{' '}
              <code>performance_landing</code>).
            </li>
          </ul>
        </p>
        <SearchQueryBuilder
          initialQuery="is:unresolved browser.name:[Firefox,Chrome] lastSeen:-7d timesSeen:>20 measurements.lcp:>300ms measurements.frames_slow_rate:<0.2"
          filterKeys={FILTER_KEYS}
          getTagValues={getTagValues}
          searchSource="storybook"
        />
      </Fragment>
    );
  });

  story('Defining filter value suggestions', () => {
    const filterValueSuggestionKeys: TagCollection = {
      predefined_values: {
        key: 'predefined_values',
        name: 'predefined_values',
        kind: FieldKind.FIELD,
        predefined: true,
        values: ['value1', 'value2', 'value3'],
      },
      predefined_categorized_values: {
        key: 'predefined_categorized_values',
        name: 'predefined_categorized_values',
        kind: FieldKind.FIELD,
        predefined: true,
        values: [
          {
            title: 'Category 1',
            type: 'header',
            icon: null,
            children: [{value: 'special value 1'}],
          },
          {
            title: 'Category 2',
            type: 'header',
            icon: null,
            children: [{value: 'special value 2'}, {value: 'special value 3'}],
          },
        ],
      },
      predefined_described_values: {
        key: 'predefined_described_values',
        name: 'predefined_described_values',
        kind: FieldKind.FIELD,
        predefined: true,
        values: [
          {
            title: '',
            type: ItemType.TAG_VALUE,
            value: 'special value 1',
            icon: null,
            documentation: 'Description for value 1',
            children: [],
          },
          {
            title: '',
            type: ItemType.TAG_VALUE,
            value: 'special value 2',
            icon: null,
            documentation: 'Description for value 2',
            children: [],
          },
        ],
      },
      async_values: {
        key: 'async_values',
        name: 'async_values',
        kind: FieldKind.FIELD,
        predefined: false,
      },
    };

    return (
      <Fragment>
        <p>
          To guide the user in building a search query, filter value suggestions can be
          provided in a few different ways:
        </p>
        <p>
          <ul>
            <li>
              <strong>Predefined</strong>: If the full set of filter keys are already
              known, they can be provided directly in <code>filterKeys</code>. These
              suggestions can also be formatted:
              <ul>
                <li>
                  <strong>Simple</strong>: For most cases, an array of strings can be
                  provided in <code>values</code>.
                </li>
                <li>
                  <strong>Categorized</strong>: If the values should be grouped, an array
                  of objects can be provided in <code>values</code>. Each object should
                  have a <code>title</code> and <code>children</code> array.
                </li>
                <li>
                  <strong>Described</strong>: If descriptions are necessary, provide an
                  array of objects of type <code>ItemType.TAG_VALUE</code> with a{' '}
                  <code>documentation</code> property.
                </li>
              </ul>
            </li>
            <li>
              <strong>Aync</strong>: If the filter key does not have{' '}
              <code>predefined: true</code>, it will use the <code>getTagValues</code>{' '}
              function to fetch suggestions. The filter key and query are provided, and it
              is up to the consumer to return the suggestions.
            </li>
          </ul>
        </p>
        <SearchQueryBuilder
          initialQuery=""
          filterKeys={filterValueSuggestionKeys}
          getTagValues={getTagValues}
          searchSource="storybook"
        />
      </Fragment>
    );
  });

  story('Customizing the filter key menu', () => {
    return (
      <Fragment>
        <p>
          A special menu can be displayed when no text is entered in the search input,
          allowing for better oranization and discovery of filter keys.
        </p>
        <p>
          This menu is defined by <code>filterKeySections</code>, which accepts a list of
          sections. Each section contains a name and a list of filter keys. Note that the
          order of both the sections and the items within each section are respected.
        </p>
        <SearchQueryBuilder
          initialQuery=""
          filterKeySections={FITLER_KEY_SECTIONS}
          filterKeys={FILTER_KEYS}
          getTagValues={getTagValues}
          searchSource="storybook"
        />
      </Fragment>
    );
  });

  story('Field definitions', () => {
    return (
      <Fragment>
        <p>
          Field definitions very important for the search query builder to work correctly.
          They provide information such as what data types are allow for a given filter,
          as well as the description and keywords.
        </p>
        <p>
          By default, field definitions are sourced from{' '}
          <code>EVENT_FIELD_DEFINITIONS</code> in <code>sentry/utils/fields.ts</code>. If
          these definitions are not correct for the use case, they can be overridden by
          passing <code>fieldDefinitionGetter</code>.
        </p>
        <SearchQueryBuilder
          initialQuery=""
          filterKeys={{boolean_key: {key: 'boolean_key', name: 'boolean_key'}}}
          getTagValues={getTagValues}
          fieldDefinitionGetter={() => {
            return {
              desc: 'Customized field defintion',
              kind: FieldKind.FIELD,
              valueType: FieldValueType.BOOLEAN,
            };
          }}
          searchSource="storybook"
        />
      </Fragment>
    );
  });

  story('Callbacks', () => {
    const [onChangeValue, setOnChangeValue] = useState<string>('');
    const [onSearchValue, setOnSearchValue] = useState<string>('');

    return (
      <Fragment>
        <p>
          <code>onChange</code> is called whenever the search query changes. This can be
          used to update the UI as the user updates the query.
        </p>
        <p>
          <code>onSearch</code> is called when the user presses enter. This can be used to
          submit the search query.
        </p>
        <p>
          <ul>
            <li>
              <strong>
                Last <code>onChange</code> value
              </strong>
              : <code>{onChangeValue}</code>
            </li>
            <li>
              <strong>
                Last <code>onSearch</code> value
              </strong>
              : <code>{onSearchValue}</code>
            </li>
          </ul>
        </p>
        <SearchQueryBuilder
          initialQuery=""
          filterKeySections={FITLER_KEY_SECTIONS}
          filterKeys={FILTER_KEYS}
          getTagValues={getTagValues}
          searchSource="storybook"
          onChange={setOnChangeValue}
          onSearch={setOnSearchValue}
        />
      </Fragment>
    );
  });

  story('Configuring valid syntax', () => {
    const configs = [
      'disallowFreeText',
      'disallowLogicalOperators',
      'disallowWildcard',
      'disallowUnsupportedFilters',
    ];

    const [enabledConfigs, setEnabledConfigs] = useState<string[]>([...configs]);
    const queryBuilderOptions = enabledConfigs.reduce((acc, config) => {
      acc[config] = true;
      return acc;
    }, {});

    return (
      <Fragment>
        <p>
          There are some config options which allow you to customize which types of syntax
          are considered valid. This should be used when the search backend does not
          support certain operators like boolean logic or wildcards. Use the checkboxes
          below to enable/disable the following options:
        </p>
        <MultipleCheckbox
          onChange={setEnabledConfigs}
          value={enabledConfigs}
          name="enabled configs"
        >
          {configs.map(config => (
            <MultipleCheckbox.Item key={config} value={config}>
              <code>{config}</code>
            </MultipleCheckbox.Item>
          ))}
        </MultipleCheckbox>
        <SearchQueryBuilder
          initialQuery="(unsupported_key:value OR browser.name:Internet*) TypeError"
          filterKeySections={FITLER_KEY_SECTIONS}
          filterKeys={FILTER_KEYS}
          getTagValues={getTagValues}
          searchSource="storybook"
          {...queryBuilderOptions}
        />
        <p>
          The query above has a few invalid tokens. The invalid tokens are highlighted in
          red and display a tooltip with a message when focused. The invalid token
          messages can be customized using the <code>invalidMessages</code> prop. In this
          case, the unsupported tag message is modified with{' '}
          <JSXProperty
            name="invalidMessages"
            value={{[InvalidReason.LOGICAL_AND_NOT_ALLOWED]: 'foo bar baz'}}
          />
          .
        </p>
        <SearchQueryBuilder
          initialQuery="AND"
          filterKeySections={FITLER_KEY_SECTIONS}
          filterKeys={FILTER_KEYS}
          getTagValues={getTagValues}
          searchSource="storybook"
          disallowLogicalOperators
          invalidMessages={{[InvalidReason.LOGICAL_AND_NOT_ALLOWED]: 'foo bar baz'}}
        />
      </Fragment>
    );
  });

  story('Migrating from SmartSearchBar', () => {
    return (
      <Fragment>
        <p>
          <JSXNode name="SearchQueryBuilder" /> is a replacement for{' '}
          <JSXNode name="SmartSearchBar" />. It provides a more flexible and powerful
          search query builder.
        </p>
        <p>
          Some props have been renamed:
          <ul>
            <li>
              <code>supportedTags</code> {'->'} <code>filterKeys</code>
            </li>
            <li>
              <code>onGetTagValues</code> {'->'} <code>getTagValues</code>
            </li>
            <li>
              <code>highlightUnsupportedTags</code> {'->'}{' '}
              <code>disallowUnsupportedFilters</code>
            </li>
          </ul>
        </p>
        <p>
          Some props have been removed:
          <ul>
            <li>
              <code>excludedTags</code> is no longer supported. If a filter key should not
              be shown, do not include it in <code>filterKeys</code>.
            </li>
            <li>
              <code>(boolean|date|duration)Keys</code> no longer need to be specified. The
              filter value types are inferred from the field definitions.
            </li>
            <li>
              <code>projectIds</code> was used to add <code>is_multi_project</code> to
              some of the analytics events. If your use case requires this, you can record
              these events manually with the <code>onSearch</code> callback.
            </li>
          </ul>
        </p>
      </Fragment>
    );
  });
});
