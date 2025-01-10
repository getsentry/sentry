import type {Field, JsonFormObject} from 'sentry/components/forms/types';
import type {FormSearchField} from 'sentry/stores/formSearchStore';
import FormSearchStore from 'sentry/stores/formSearchStore';

type Params = {
  fields: Record<string, Field>;
  formGroups: JsonFormObject[];
  route: string;
};
/**
 * Creates a list of objects to be injected by a search source
 *
 * @param route The route a form field belongs on
 * @param formGroups An array of `FormGroup: {title: string, fields: [Field]}`
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
    ? formGroups.flatMap(formGroup => formGroup.fields)
    : Object.keys(fields).map(fieldName => fields[fieldName]);

  return listOfFields.map<FormSearchField>(field => ({
    ...other,
    route,
    title: typeof field !== 'function' ? (field?.label as string) : undefined,
    description: typeof field !== 'function' ? (field?.help as string) : undefined,
    // @ts-expect-error TS(2322): Type 'Function | (CustomType & BaseField) | ({ typ... Remove this comment to see the full error message
    field,
  }));
};

export function loadSearchMap() {
  // Load all form configuration files via webpack that export a named `route`
  // as well as either `fields` or `formGroups`
  const context = require.context('../data/forms', true, /\.tsx?$/);

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

  FormSearchStore.loadSearchMap(allFormFields);
}
