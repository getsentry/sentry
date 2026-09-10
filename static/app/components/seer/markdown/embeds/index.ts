import {AgentWriteApprovalEmbed} from './components/agentWriteApproval';
import {Alert} from './components/alert/alert';
import {Autofix, AutofixRef} from './components/autofix';
import {Chart} from './components/chart';
import {Conversation} from './components/conversation/conversation';
import {ConversationsQuery} from './components/conversationsQuery';
import {Dashboard} from './components/dashboard';
import {Docs} from './components/docs';
import {Dsn} from './components/dsn';
import {ErrorsQuery} from './components/errorsQuery';
import {SeerEvent} from './components/event/event';
import {Issue, Issues} from './components/issue';
import {IssuesQuery} from './components/issuesQuery';
import {Log} from './components/log/log';
import {LogsQuery} from './components/logsQuery';
import {MetricsQuery} from './components/metricsQuery';
import {Monitor} from './components/monitor/monitor';
import {Profile} from './components/profile/profile';
import {PullRequestRefEmbed} from './components/pullRequestRef';
import {Release} from './components/release';
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
  Conversation,
  ConversationsQuery,
  Dashboard,
  Docs,
  Dsn,
  ErrorsQuery,
  Issue,
  Issues,
  IssuesQuery,
  Log,
  LogsQuery,
  MetricsQuery,
  Monitor,
  Profile,
  PullRequestRefEmbed,
  Release,
  Replay,
  ReplaysQuery,
  SavedIssueView,
  SavedQuery,
  SeerEvent,
  SpansQuery,
  Timestamp,
  Trace,
  User,
];
for (const embed of embeds) {
  SeerEmbedRegistry.register(embed.displayName, embed);
}

export {SeerEmbedRegistry} from './registry';
