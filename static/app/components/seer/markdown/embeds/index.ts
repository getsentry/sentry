// When adding a new embed, just drop a file in ./components/ and import it here
import {Timestamp} from './components/timestamp';
import {Todos} from './components/todos';
import {SeerEmbedRegistry} from './registry';

const embeds = [Timestamp, Todos];
for (const embed of embeds) {
  SeerEmbedRegistry.register(embed.displayName, embed);
}

export {SeerEmbedRegistry} from './registry';
