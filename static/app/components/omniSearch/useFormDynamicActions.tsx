import {useEffect, useMemo, useState} from 'react';

import type {Field, FieldObject, JsonFormObject} from 'sentry/components/forms/types';
import {IconSettings} from 'sentry/icons';

import type {OmniAction} from './types';

type FormSearchField = {
  description: React.ReactNode;
  field: FieldObject;
  route: string;
  title: React.ReactNode;
};

let ALL_FORM_FIELDS_CACHED: FormSearchField[] | null = null;

type SearchMapParams = {
  fields: Record<string, Field>;
  formGroups: JsonFormObject[];
  route: string;
};

/**
 * Creates a list of objects to be injected by a search source
 */
function createSearchMap({
  route,
  formGroups,
  fields,
  ...other
}: SearchMapParams): FormSearchField[] {
  // There are currently two ways to define forms:
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
 * Hook that provides all form fields as OmniActions for the OmniSearch palette.
 * No filtering is done here - palette.tsx handles the search.
 *
 * @returns Array of all available form field actions
 */
export function useFormDynamicActions(): OmniAction[] {
  const [formFields, setFormFields] = useState<FormSearchField[]>([]);

  useEffect(() => {
    setFormFields(getSearchMap());
  }, []);

  const dynamicActions = useMemo(() => {
    return formFields.map((item, index) => ({
      key: `form-${index}`,
      areaKey: 'global',
      label: item.title as string,
      details: item.description as string,
      section: 'Settings',
      actionIcon: <IconSettings />,
      to: {pathname: item.route, hash: `#${encodeURIComponent(item.field.name)}`},
    }));
  }, [formFields]);

  return dynamicActions;
}
