// When adding a new embed, just drop a file in ./components/ and import it here
import {Timestamp} from './components/timestamp';
import {SeerEmbedRegistry} from './registry';

const embeds = [Timestamp];
for (const embed of embeds) {
  SeerEmbedRegistry.register(embed.displayName, embed);
}

export {SeerEmbedRegistry} from './registry';
