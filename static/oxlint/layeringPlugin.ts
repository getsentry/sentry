// `@boundaries/eslint-plugin` under a second plugin name. Oxlint loads a plugin
// module once, so the `layering/dependencies` rule needs its own module to be
// configured (and enrolled as an incubator rule) separately from
// `boundaries/dependencies`. Both read the same `boundaries/*` settings.
import boundaries from '@boundaries/eslint-plugin';

const layeringPlugin = {...boundaries, meta: {...boundaries.meta, name: 'layering'}};

export default layeringPlugin;
