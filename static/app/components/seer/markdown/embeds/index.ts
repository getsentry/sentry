import {Chart} from './components/chart';
import {Docs} from './components/docs';
import {Dsn} from './components/dsn';
import {Timestamp} from './components/timestamp';
import {User} from './components/user';
import {SeerEmbedRegistry} from './registry';

const embeds = [Chart, Docs, Dsn, Timestamp, User];
for (const embed of embeds) {
  SeerEmbedRegistry.register(embed.displayName, embed);
}

export {SeerEmbedRegistry} from './registry';
