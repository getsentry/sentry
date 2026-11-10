// react-select 4 has declarations only for its extensionless directory entry.
// Use its shipped JavaScript entry so native ESM consumers can resolve it too.
declare module 'react-select/creatable/dist/react-select.cjs.js' {
  import type Creatable from 'react-select/creatable';

  const component: typeof Creatable | {default: typeof Creatable};
  export default component;
}
