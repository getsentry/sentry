import {TanStackDevtools} from '@tanstack/react-devtools';
import {formDevtoolsPlugin} from '@tanstack/react-form-devtools';
import {hotkeysDevtoolsPlugin} from '@tanstack/react-hotkeys-devtools';
import {pacerDevtoolsPlugin} from '@tanstack/react-pacer-devtools';
import {ReactQueryDevtoolsPanel} from '@tanstack/react-query-devtools';

const plugins = [
  {
    name: 'TanStack Query',
    render: <ReactQueryDevtoolsPanel />,
  },
  formDevtoolsPlugin(),
  hotkeysDevtoolsPlugin(),
  pacerDevtoolsPlugin(),
];

export function SentryTanStackDevtools() {
  return <TanStackDevtools config={{position: 'bottom-right'}} plugins={plugins} />;
}
