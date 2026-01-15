import {useCallback, useEffect, useMemo, useState} from 'react';

import type {Field, FieldObject, JsonFormObject} from 'sentry/components/forms/types';
import type {Fuse} from 'sentry/utils/fuzzySearch';
import {createFuzzySearch} from 'sentry/utils/fuzzySearch';

import type {ChildProps, Result, ResultItem} from './types';
import {makeResolvedTs, strGetFn} from './utils';

export type FormSearchField = {
  description: React.ReactNode;
  field: FieldObject;
  route: string;
  title: React.ReactNode;
};

let ALL_FORM_FIELDS_CACHED: FormSearchField[] | null = null;

type SearchMapParams = {
  fields: Record<string, Field>;
  formGroups: readonly JsonFormObject[];
  route: string;
};

/**
 * Creates a list of objects to be injected by a search source
 *
 * @param route The route a form field belongs on
 * @param formGroups An array of `FormGroup: {title: string, fields: [Field]}`
 * @param fields An object whose key is field name and value is a `Field`
 */
function createSearchMap({
  route,
  formGroups,
  fields,
  ...other
}: SearchMapParams): FormSearchField[] {
  // There are currently two ways to define forms (TODO(billy): Turn this into one):
  // If `formGroups` is defined, then return a flattened list of fields in all formGroups
  // Otherwise `fields` is a map of fieldName -> fieldObject -- create a list of fields
  const listOfFields = formGroups
    ? formGroups.flatMap(formGroup => formGroup.fields)
    : Object.keys(fields).map(fieldName => fields[fieldName]);

  return listOfFields.map<FormSearchField>(field => ({
    ...other,
    route,
    title: typeof field === 'function' ? undefined : (field?.label as string),
    description: typeof field === 'function' ? undefined : (field?.help as string),
    field: field!,
  }));
}

function getSearchMap() {
  if (ALL_FORM_FIELDS_CACHED !== null) {
    return ALL_FORM_FIELDS_CACHED;
  }

  // Load all form configuration files via webpack that export a named `route`
  // as well as either `fields` or `formGroups`
  const context = require.context('sentry/data/forms', true, /\.tsx?$/);

  // Get a list of all form fields defined in `../data/forms`
  const allFormFields: FormSearchField[] = context.keys().flatMap((key: any) => {
    const mod = context(key);

    // Since we're dynamically importing an entire directly, there could be malformed modules defined?
    // Only look for module that have `route` exported
    if (!mod?.route) {
      return [];
    }

    const searchMap = createSearchMap({
      // `formGroups` can be a default export or a named export :<
      formGroups: mod.default || mod.formGroups,
      fields: mod.fields,
      route: mod.route,
    });

    if (searchMap !== null) {
      return searchMap;
    }

    return [];
  });

  ALL_FORM_FIELDS_CACHED = allFormFields;
  return allFormFields;
}

/**
 * @internal Used specifically for tests
 */
export function setSearchMap(fields: FormSearchField[]) {
  ALL_FORM_FIELDS_CACHED = fields;
}

interface Props {
  children: (props: ChildProps) => React.ReactElement;
  /**
   * search term
   */
  query: string;
  /**
   * fusejs options.
   */
  searchOptions?: Fuse.IFuseOptions<FormSearchField>;
}

function FormSource({searchOptions, query, children}: Props) {
  const [fuzzy, setFuzzy] = useState<Fuse<FormSearchField> | null>(null);

  const createSearch = useCallback(async () => {
    setFuzzy(
      await createFuzzySearch(getSearchMap(), {
        ...searchOptions,
        keys: ['title', 'description'],
        getFn: strGetFn,
      })
    );
  }, [searchOptions]);

  useEffect(() => void createSearch(), [createSearch]);

  const results = useMemo(() => {
    const resolvedTs = makeResolvedTs();
    return (
      fuzzy?.search(query).map<Result>(({item, ...rest}) => ({
        item: {
          ...item,
          sourceType: 'field',
          resultType: 'field',
          to: {pathname: item.route, hash: `#${encodeURIComponent(item.field.name)}`},
          resolvedTs,
        } as ResultItem,
        ...rest,
      })) ?? []
    );
  }, [fuzzy, query]);

  return children({
    isLoading: fuzzy === null,
    results,
  });
}

export default FormSource;
