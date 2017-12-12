import {fromPairs, flatMap} from 'lodash';

// Create a simple search index for a field
export const createSearchIndex = field => {
  let fields = [field.name, field.label, field.help];

  return fields
    .join('')
    .toLowerCase()
    .replace(' ', '');
};

// need to associate index -> form group -> route
// so when we search for a term we need to find:
//   * what field(s) it matches:
//     * what form group it belongs to
//     * what route that belongs to
export const createSearchMap = ({route, formGroups, ...other}) => {
  return fromPairs(
    flatMap(formGroups, ({title, fields}) =>
      fields.map(field => [
        createSearchIndex(field),
        {
          ...other,
          route,
          groupTitle: title,
          field,
        },
      ])
    )
  );
};
