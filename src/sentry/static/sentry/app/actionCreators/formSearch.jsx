import {flatten, flatMap} from 'lodash';

import FormSearchActions from '../actions/formSearchActions';

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

export function loadSearchMap() {
  // Load search map by directory via webpack
  let context = require.context('../data/forms', true, /\.jsx$/);
  FormSearchActions.loadSearchMap(
    flatten(
      context
        .keys()
        .map(function(key) {
          let mod = context(key);

          if (!mod) return null;
          if (!mod.route) return null;

          return createSearchMap({
            formGroups: mod.default || mod.formGroups,
            fields: mod.fields,
            route: mod.route,
          });
        })
        .filter(i => !!i)
    )
  );
}
