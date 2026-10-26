import {TanStackDevtools} from '@tanstack/react-devtools';
import {formDevtoolsPlugin} from '@tanstack/react-form-devtools';
import {pacerDevtoolsPlugin} from '@tanstack/react-pacer-devtools';
import {ReactQueryDevtoolsPanel} from '@tanstack/react-query-devtools';

export function SentryTanStackDevtools() {
  return (
    <TanStackDevtools
      config={{position: 'bottom-right'}}
      plugins={[
        {
          name: 'TanStack Query',
          render: <ReactQueryDevtoolsPanel />,
        },
        formDevtoolsPlugin(),
        pacerDevtoolsPlugin(),
      ]}
    />
  );
}
