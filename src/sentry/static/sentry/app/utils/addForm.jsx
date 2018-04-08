import {flatMap} from 'lodash';

import {addSearchMap} from '../actionCreators/formSearch';

// need to associate index -> form group -> route
// so when we search for a term we need to find:
//   * what field(s) it matches:
//     * what form group it belongs to
//     * what route that belongs to
const createSearchMap = ({route, formGroups, fields, ...other}) => {
  let listOfFields = formGroups
    ? flatMap(formGroups, formGroup => formGroup.fields)
    : Object.keys(fields).map(fieldName => fields[fieldName]);

  return listOfFields.map(field => ({
    ...other,
    route,
    title: field.label,
    description: field.help,
    field,
  }));
};

/**
 * Given a `formGroup` ({ title: string, fields: Array<FormField> }) (or just `fields`)
 * and `route` where form exists, create a search index for fields.
 *
 * Adds to a global search store.
 *
 * returns formGroup
 */
export default function addForm({formGroups, route, ...other}) {
  if (route) {
    // Only create searchMap if route is defined
    addSearchMap(createSearchMap({route, formGroups, ...other}));
  }

  return formGroups;
}
