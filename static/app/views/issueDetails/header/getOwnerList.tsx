import {t} from 'sentry/locale';
import type {Actor} from 'sentry/types/core';
import type {SuggestedOwnerReason} from 'sentry/types/group';
import type {Commit, Committer} from 'sentry/types/integrations';
import type {Team} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

/**
 * example: codeowners:/issues -> [['codeowners', '/issues']]
 */
type RuleDefinition = [string, string];
/**
 * example: #team1 -> ['team', 'team1']
 */
type RuleOwner = [string, string];
type Rule = [RuleDefinition, RuleOwner[]];

/**
 * Given a list of rule objects returned from the API, locate the matching
 * rules for a specific owner.
 */
function findMatchedRules(
  rules: EventOwners['rules'],
  owner: Actor
): Array<Rule[0]> | undefined {
  if (!rules) {
    return undefined;
  }

  const matchOwner = (actorType: Actor['type'], key: string) =>
    (actorType === 'user' && key === owner.email) ||
    (actorType === 'team' && key === owner.name);

  const actorHasOwner = ([actorType, key]: RuleOwner) =>
    actorType === owner.type && matchOwner(actorType, key);

  return rules
    .filter(([_, ruleActors]) => ruleActors.find(actorHasOwner))
    .map(([rule]) => rule);
}

type IssueOwner = {
  actor: Actor;
  source: 'codeowners' | 'projectOwnership' | 'suspectCommit';
  commits?: Commit[];
  rules?: Array<[string, string]> | null;
};
export interface EventOwners {
  owners: Actor[];
  rule: RuleDefinition;
  rules: Rule[];
}

function getSuggestedReason(owner: IssueOwner) {
  if (owner.commits) {
    return t('Suspect commit author');
  }

  if (owner.rules?.length) {
    const firstRule = owner.rules[0]!;
    return `${toTitleCase(firstRule[0])}:${firstRule[1]}`;
  }

  return '';
}

type SuggestedAssignee = Actor & {
  assignee: AssignableTeam | User;
  suggestedReason: SuggestedOwnerReason;
  suggestedReasonText?: React.ReactNode;
};

type AssignableTeam = {
  display: string;
  email: string;
  id: string;
  team: Team;
};

/**
 * Combine the committer and ownership data into a single array, merging
 * users who are both owners based on having commits, and owners matching
 * project ownership rules into one array.
 *
 * ### The return array will include objects of the format:
 *
 * ```ts
 *   actor: <
 *    type,              # Either user or team
 *    {User},            # API expanded user object
 *    {email, id, name}  # Sentry user which is *not* expanded
 *    {email, name}      # Unidentified user (from commits)
 *    {id, name},        # Sentry team (check `type`)
 *   >,
 * ```
 *
 * ### One or both of commits and rules will be present
 *
 * ```ts
 *   commits: [...]  # List of commits made by this owner
 *   rules:   [...]  # Project rules matched for this owner
 * ```
 */
export function getOwnerList(
  committers: Committer[],
  eventOwners: EventOwners | undefined,
  assignedTo: Actor | null
): Array<Omit<SuggestedAssignee, 'assignee'>> {
  const owners: IssueOwner[] = committers.map(commiter => ({
    actor: {...commiter.author, type: 'user'},
    commits: commiter.commits,
    source: 'suspectCommit',
  }));

  eventOwners?.owners.forEach(owner => {
    const matchingRule = findMatchedRules(eventOwners?.rules || [], owner);
    const normalizedOwner: IssueOwner = {
      actor: owner,
      rules: matchingRule,
      source: matchingRule?.[0]?.[0] === 'codeowners' ? 'codeowners' : 'projectOwnership',
    };

    const existingIdx =
      committers.length > 0 && owner.email && owner.type === 'user'
        ? owners.findIndex(o => o.actor.email === owner.email)
        : -1;
    if (existingIdx > -1) {
      owners[existingIdx] = {...normalizedOwner, ...owners[existingIdx]};
      return;
    }
    owners.push(normalizedOwner);
  });

  // Do not display current assignee
  const filteredOwners = owners.filter(
    owner => !(owner.actor.type === assignedTo?.type && owner.actor.id === assignedTo?.id)
  );

  // Convert to suggested assignee format
  return filteredOwners.map<Omit<SuggestedAssignee, 'assignee'>>(owner => ({
    ...owner.actor,
    suggestedReasonText: getSuggestedReason(owner),
    suggestedReason: owner.source,
  }));
}
