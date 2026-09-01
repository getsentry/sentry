import {AgentWriteApprovalEmbed} from './components/agentWriteApproval';
import {Alert} from './components/alert';
import {Autofix, AutofixRef} from './components/autofix';
import {Chart} from './components/chart';
import {Dashboard} from './components/dashboard';
import {Docs} from './components/docs';
import {Dsn} from './components/dsn';
import {ErrorsQuery} from './components/errorsQuery';
import {Issue, Issues} from './components/issue';
import {IssuesQuery} from './components/issuesQuery';
import {LogsQuery} from './components/logsQuery';
import {MetricsQuery} from './components/metricsQuery';
import {Monitor} from './components/monitor';
import {Profile} from './components/profile';
import {Replay} from './components/replay';
import {ReplaysQuery} from './components/replaysQuery';
import {SavedIssueView} from './components/savedIssueView';
import {SavedQuery} from './components/savedQuery';
import {SpansQuery} from './components/spansQuery';
import {Timestamp} from './components/timestamp';
import {Trace} from './components/trace';
import {User} from './components/user';
import {SeerEmbedRegistry} from './registry';

const embeds = [
  AgentWriteApprovalEmbed,
  Alert,
  Autofix,
  AutofixRef,
  Chart,
  Dashboard,
  Docs,
  Dsn,
  ErrorsQuery,
  Issue,
  Issues,
  IssuesQuery,
  LogsQuery,
  MetricsQuery,
  Monitor,
  Profile,
  Replay,
  ReplaysQuery,
  SavedIssueView,
  SavedQuery,
  SpansQuery,
  Timestamp,
  Trace,
  User,
];
for (const embed of embeds) {
  SeerEmbedRegistry.register(embed.displayName, embed);
}

export {SeerEmbedRegistry} from './registry';
