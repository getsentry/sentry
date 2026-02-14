import {Fragment} from 'react';
import debounce from 'lodash/debounce';
import * as qs from 'query-string';

import {Client} from 'sentry/api';
import type FormModel from 'sentry/components/forms/model';
import type {FieldValue} from 'sentry/components/forms/types';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t, tct} from 'sentry/locale';
import type {Choices, SelectValue} from 'sentry/types/core';
import type {IntegrationIssueConfig, IssueConfigField} from 'sentry/types/integrations';

export type ExternalIssueAction = 'create' | 'link';
export type ExternalIssueFormErrors = Record<string, React.ReactNode>;

// This exists because /extensions/type/search API is not prefixed with
// /api/0/, but the default API client on the abstract issue form is...
const API_CLIENT = new Client({baseUrl: '', headers: {}});
const DEBOUNCE_MS = 200;

async function getOptionLoad({
  field,
  input,
  callback,
  dynamicFieldValues,
}: {
  callback: (err: Error | null, result?: any) => void;
  dynamicFieldValues: Record<string, FieldValue | null>;
  field: IssueConfigField;
  input: string;
}) {
  const query = qs.stringify({
    ...dynamicFieldValues,
    field: field.name,
    query: input,
  });

  const url = field.url || '';
  const separator = url.includes('?') ? '&' : '?';
  // We can't use the API client here since the URL is not scoped under the
  // API endpoints (which the client prefixes)

  try {
    const response = await API_CLIENT.requestPromise(url + separator + query);
    callback(null, response);
  } catch (err: any) {
    callback(err);
  }
}

const debouncedOptionLoad = debounce(
  ({
    field,
    input,
    callback,
    dynamicFieldValues,
  }: {
    callback: (err: Error | null, result?: any) => void;
    dynamicFieldValues: Record<string, FieldValue | null>;
    field: IssueConfigField;
    input: string;
  }) => getOptionLoad({field, input, callback, dynamicFieldValues}),
  DEBOUNCE_MS,
  {trailing: true}
);

function getDefaultOptions({
  field,
}: {
  field: IssueConfigField;
}): Array<SelectValue<string | number>> {
  const choices =
    (field.choices as Array<[number | string, number | string | React.ReactElement]>) ||
    [];
  return choices.map(([value, label]) => ({value, label}));
}

/**
 * Ensures current result from Async select fields is never discarded. Without this method,
 * searching in an async select field without selecting one of the returned choices will
 * result in a value saved to the form, and no associated label; appearing empty.
 * @param field The field being examined
 * @param result The result from its asynchronous query
 * @param model The form model
 * @returns The result with a tooltip attached to the current option
 */
function ensureCurrentOption({
  field,
  result,
  model,
}: {
  field: IssueConfigField;
  model: FormModel;
  result: Array<SelectValue<string | number>>;
}): Array<SelectValue<string | number>> {
  const currentOption = getDefaultOptions({field}).find(
    option => option.value === model.getValue(field.name)
  );
  if (!currentOption) {
    return result;
  }
  if (typeof currentOption.label === 'string') {
    currentOption.label = (
      <Fragment>
        <QuestionTooltip
          title={tct('This is your current [label].', {
            label: field.label as React.ReactNode,
          })}
          size="xs"
        />{' '}
        {currentOption.label}
      </Fragment>
    );
  }
  const currentOptionResultIndex = result.findIndex(
    obj => obj.value === currentOption?.value
  );
  // Has a selected option, and it is in API results
  if (currentOptionResultIndex >= 0) {
    const newResult = result;
    newResult[currentOptionResultIndex] = currentOption;
    return newResult;
  }
  // Has a selected option, and it is not in API results
  return [...result, currentOption];
}

export function getConfigName(
  action: ExternalIssueAction
): 'createIssueConfig' | 'linkIssueConfig' {
  switch (action) {
    case 'create':
      return 'createIssueConfig';
    case 'link':
      return 'linkIssueConfig';
    default:
      throw new Error('illegal action');
  }
}

/**
 * Get the list of options for a field via debounced API call. For example,
 * the list of users that match the input string. The Promise rejects if there
 * are any errors.
 */
export function getOptions({
  field,
  input,
  model,
  successCallback,
  dynamicFieldValues = {},
}: {
  field: IssueConfigField;
  input: string;
  model: FormModel;
  dynamicFieldValues?: Record<string, FieldValue | null>;
  successCallback?: ({
    field,
    result,
  }: {
    field: IssueConfigField;
    result: Array<SelectValue<string | number>>;
  }) => void;
}) {
  return new Promise<Array<SelectValue<string | number>>>((resolve, reject) => {
    if (!input) {
      return resolve(getDefaultOptions({field}));
    }
    return debouncedOptionLoad({
      field,
      input,
      callback: (err, result) => {
        if (err) {
          reject(err);
        } else {
          result = ensureCurrentOption({field, result, model});
          successCallback?.({field, result});
          resolve(result);
        }
      },
      dynamicFieldValues,
    });
  });
}

/**
 * Convert IntegrationIssueConfig to an object that maps field names to the
 * values of fields where `updatesForm` is true.
 * @returns Object of field names to values.
 */
export function getDynamicFields({
  action,
  integrationDetails,
}: {
  action: ExternalIssueAction;
  integrationDetails?: IntegrationIssueConfig | null;
}): Record<string, FieldValue | null> {
  const config = integrationDetails?.[getConfigName(action)];
  return Object.fromEntries(
    (config || [])
      .filter((field: IssueConfigField) => field.updatesForm)
      .map((field: IssueConfigField) => [field.name, field.default || null])
  );
}

/**
 * If this field is an async select (field.url is not null), add async props.
 * XXX: We pass through loadOptions since it's highly opinionated in the abstract class.
 */
export function getFieldProps({
  field,
  loadOptions,
}: {
  field: IssueConfigField;
  loadOptions: (input: string) => Promise<Array<SelectValue<string | number>>>;
}) {
  if (!field.url) {
    return {};
  }
  return {
    async: true,
    autoload: true,
    cache: false,
    loadOptions,
    defaultOptions: getDefaultOptions({field}),
    onBlurResetsInput: false,
    onCloseResetsInput: false,
    onSelectResetsInput: false,
    placeholder: t('Type to search'),
  };
}

/**
 * Populate all async fields with their choices, then return the full list of fields.
 * We pull from the fetchedFieldOptionsCache which contains the most recent choices
 * for each async field.
 */
export function loadAsyncThenFetchAllFields({
  configName,
  integrationDetails,
  fetchedFieldOptionsCache,
}: {
  configName: 'createIssueConfig' | 'linkIssueConfig';
  fetchedFieldOptionsCache: Record<string, Choices>;
  integrationDetails: IntegrationIssueConfig | null;
}): IssueConfigField[] {
  const configsFromAPI = integrationDetails?.[configName];
  return (configsFromAPI || []).map(field => {
    const fieldCopy = {...field};
    // Overwrite choices from cache.
    if (fetchedFieldOptionsCache?.hasOwnProperty(field.name)) {
      fieldCopy.choices = fetchedFieldOptionsCache[field.name];
    }
    return fieldCopy;
  });
}

/**
 * check if we have any form fields with name error and type blank
 */
export function hasErrorInFields({fields}: {fields: IssueConfigField[]}) {
  return fields.some(field => field.name === 'error' && field.type === 'blank');
}
