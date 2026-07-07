import {InlineCode} from '@sentry/scraps/code';
import {Text} from '@sentry/scraps/text';

import * as Storybook from 'sentry/stories';
import {SeerComponentRegistry} from 'sentry/views/seerExplorer/components/chat/seerComponents';

export function SeerEmbedTable() {
  const embeds = SeerComponentRegistry.list();

  return (
    <Storybook.Table>
      <thead>
        <tr>
          <th>Tag</th>
          <th>Rendered</th>
        </tr>
      </thead>
      <tbody>
        {embeds.map(({name, component: Embed, example}) => (
          <tr key={name}>
            <td>
              <InlineCode>{name}</InlineCode>
            </td>
            <td>{example ? <Embed {...example} /> : <Text variant="muted">—</Text>}</td>
          </tr>
        ))}
      </tbody>
    </Storybook.Table>
  );
}
