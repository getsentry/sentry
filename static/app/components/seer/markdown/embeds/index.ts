import {AgentWriteApprovalEmbed} from './components/agentWriteApproval';
import {Autofix} from './components/autofix';
import {Chart} from './components/chart';
import {Dashboard} from './components/dashboard';
import {Docs} from './components/docs';
import {Dsn} from './components/dsn';
import {Issue, Issues} from './components/issue';
import {Replay} from './components/replay';
import {Timestamp} from './components/timestamp';
import {User} from './components/user';
import {SeerEmbedRegistry} from './registry';

const embeds = [
  AgentWriteApprovalEmbed,
  Autofix,
  Chart,
  Dashboard,
  Docs,
  Dsn,
  Issue,
  Issues,
  Replay,
  Timestamp,
  User,
];
for (const embed of embeds) {
  SeerEmbedRegistry.register(embed.displayName, embed);
}

export {SeerEmbedRegistry} from './registry';
