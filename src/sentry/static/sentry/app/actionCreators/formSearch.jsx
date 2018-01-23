import FormSearchActions from '../actions/formSearchActions';
import addForm from '../utils/addForm';

export function addSearchMap(searchMap) {
  FormSearchActions.addSearchMap(searchMap);
}

export function loadSearchMap() {
  // Load search map by directory via webpack
  let context = require.context('../data/forms', true, /\.jsx$/);
  context.keys().forEach(function(key) {
    let mod = context(key);

    if (!mod) return;

    addForm({formGroups: mod.default || mod.formGroups, route: mod.route});
  });
}
