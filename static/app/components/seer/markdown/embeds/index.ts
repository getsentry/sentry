import {Chart} from './components/chart';
import {Docs} from './components/docs';
import {Dsn} from './components/dsn';
import {Issue, Issues} from './components/issue';
import {Timestamp} from './components/timestamp';
import {User} from './components/user';
import {SeerEmbedRegistry} from './registry';

const embeds = [Chart, Docs, Dsn, Issue, Issues, Timestamp, User];
for (const embed of embeds) {
  SeerEmbedRegistry.register(embed.displayName, embed);
}

export {SeerEmbedRegistry} from './registry';
