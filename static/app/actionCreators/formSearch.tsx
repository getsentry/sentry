import flatMap from 'lodash/flatMap';
import flatten from 'lodash/flatten';

import FormSearchActions from 'sentry/actions/formSearchActions';
import {Field, JsonFormObject} from 'sentry/components/forms/type';
import {FormSearchField} from 'sentry/stores/formSearchStore';

type Params = {
  fields: Record<string, Field>;
  formGroups: JsonFormObject[];
  route: string;
};
/**
 * Creates a list of objects to be injected by a search source
 *
 * @param route The route a form field belongs on
 * @param formGroups An array of `FormGroup: {title: String, fields: [Field]}`
 * @param fields An object whose key is field name and value is a `Field`
 */
const createSearchMap = ({
  route,
  formGroups,
  fields,
  ...other
}: Params): FormSearchField[] => {
  // There are currently two ways to define forms (TODO(billy): Turn this into one):
  // If `formGroups` is defined, then return a flattened list of fields in all formGroups
  // Otherwise `fields` is a map of fieldName -> fieldObject -- create a list of fields
  const listOfFields = formGroups
    ? flatMap(formGroups, formGroup => formGroup.fields)
    : Object.keys(fields).map(fieldName => fields[fieldName]);

  return listOfFields.map(field => ({
    ...other,
    route,
    title: typeof field !== 'function' ? field.label : undefined,
    description: typeof field !== 'function' ? field.help : undefined,
    field,
  }));
};

export function loadSearchMap() {
  // Load all form configuration files via webpack that export a named `route`
  // as well as either `fields` or `formGroups`
  // @ts-ignore This fails on cloud builder, but not in CI...
  const context = require.context('../data/forms', true, /\.[tj]sx?$/);

  // Get a list of all form fields defined in `../data/forms`
  const allFormFields = flatten(
    context
      .keys()
      .map(key => {
        const mod = context(key);

        // Since we're dynamically importing an entire directly, there could be malformed modules defined?
        if (!mod) {
          return null;
        }
        // Only look for module that have `route` exported
        if (!mod.route) {
          return null;
        }

        return createSearchMap({
          // `formGroups` can be a default export or a named export :<
          formGroups: mod.default || mod.formGroups,
          fields: mod.fields,
          route: mod.route,
        });
      })
      .filter(i => !!i)
  );

  FormSearchActions.loadSearchMap(allFormFields);
}
