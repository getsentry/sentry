import {createParser} from 'nuqs';

export const parseAsBooleanLiteral = createParser({
  parse: v => (v === '1' ? true : null),
  serialize: () => '1',
});
