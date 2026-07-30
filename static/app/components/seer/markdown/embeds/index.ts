import {Docs} from './components/docs';
import {Dsn} from './components/dsn';
import {Timestamp} from './components/timestamp';
import {SeerEmbedRegistry} from './registry';

const embeds = [Docs, Dsn, Timestamp];
for (const embed of embeds) {
  SeerEmbedRegistry.register(embed.displayName, embed);
}

export {SeerEmbedRegistry} from './registry';
