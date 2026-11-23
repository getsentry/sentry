import {createPackageConfig} from '../../../oxlint.base.ts';

export default createPackageConfig(import.meta.dirname, {
  rules: {'@sentry/scraps/prefer-primitives': 'error'},
});
