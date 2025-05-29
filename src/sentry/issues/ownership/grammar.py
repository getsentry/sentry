from __future__ import annotations

import re
from collections import namedtuple
from collections.abc import Callable, Iterable, Mapping, Sequence
from typing import TYPE_CHECKING, Any, NamedTuple

from parsimonious.exceptions import ParseError
from parsimonious.grammar import Grammar
from parsimonious.nodes import Node
from parsimonious.nodes import NodeVisitor as BaseNodeVisitor
from rest_framework.serializers import ValidationError

from sentry.eventstore.models import EventSubjectTemplateData
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.organizationmember import OrganizationMember
from sentry.types.actor import Actor, ActorType
from sentry.users.services.user.service import user_service
from sentry.utils.codeowners import codeowners_match
from sentry.utils.event_frames import find_stack_frames, get_sdk_name, munged_filename_and_frames
from sentry.utils.glob import glob_match
from sentry.utils.safe import get_path

__all__ = ("parse_rules", "dump_schema", "load_schema")

if TYPE_CHECKING:
    NodeVisitor = BaseNodeVisitor[str]
else:
    NodeVisitor = BaseNodeVisitor

VERSION = 1

URL = "url"
PATH = "path"
MODULE = "module"
CODEOWNERS = "codeowners"

# Grammar is defined in EBNF syntax.
ownership_grammar = Grammar(
    rf"""

ownership = line*

line = _ (comment / rule / empty) newline?

rule = _ matcher owners

matcher      = _ matcher_tag any_identifier
matcher_tag  = (matcher_type sep)?
matcher_type = "{URL}" / "{PATH}" / "{MODULE}" / "{CODEOWNERS}" / event_tag

event_tag   = ~r"tags.[^:]+"

owners       = _ owner+
owner        = _ team_prefix identifier
team_prefix  = "#"?

comment = ~r"#[^\r\n]*"

# TODO: make more specific
any_identifier = quoted_identifier / identifier
identifier = ~r"\S+"
quoted_identifier = ~r'"([^"\\]*(?:\\.[^"\\]*)*)"'

sep     = ":"
space   = " "
empty   = ""
newline = ~r"[\r\n]"
_       = space*

"""
)


class Rule(namedtuple("Rule", "matcher owners")):
    """
    A Rule represents a single line in an Ownership file.
    This line contains a Matcher and a list of Owners.
    """

    def __str__(self) -> str:
        owners = [o.dump() for o in self.owners]
        owners_str = " ".join(
            f"#{owner['identifier']}" if owner["type"] == "team" else owner["identifier"]
            for owner in owners
        )
        return f"{self.matcher} {owners_str}"

    def dump(self) -> dict[str, Sequence[Owner]]:
        return {"matcher": self.matcher.dump(), "owners": [o.dump() for o in self.owners]}

    @classmethod
    def load(cls, data: Mapping[str, Any]) -> Rule:
        return cls(Matcher.load(data["matcher"]), [Owner.load(o) for o in data["owners"]])

    def test(
        self,
        data: Mapping[str, Any],
        munged_data: tuple[Sequence[Mapping[str, Any]], Sequence[str]],
    ) -> bool | Any:
        return self.matcher.test(data, munged_data)


class Matcher(namedtuple("Matcher", "type pattern")):
    """
    A Matcher represents a type:pattern pairing for use in
    comparing with an Event.

    type is either `path`, `tags`, `url`, `module` or `codeowners` at this point.

    TODO(mattrobenolt): pattern needs to be parsed into a regex

    Examples:
        url:example.com
        path:src/*
        src/*
    """

    def __str__(self) -> str:
        return f"{self.type}:{self.pattern}"

    def dump(self) -> dict[str, str]:
        return {"type": self.type, "pattern": self.pattern}

    @classmethod
    def load(cls, data: Mapping[str, str]) -> Matcher:
        return cls(data["type"], data["pattern"])

    @staticmethod
    def munge_if_needed(
        data: Mapping[str, Any]
    ) -> tuple[Sequence[Mapping[str, Any]], Sequence[str]]:
        keys = ["filename", "abs_path"]
        platform = data.get("platform")
        sdk_name = get_sdk_name(data)
        frames = find_stack_frames(data)
        if platform:
            munged = munged_filename_and_frames(platform, frames, "munged_filename", sdk_name)
            if munged:
                keys.append(munged[0])
                frames = munged[1]

        return frames, keys

    def test(
        self,
        data: Mapping[str, Any],
        munged_data: tuple[Sequence[Mapping[str, Any]], Sequence[str]],
    ) -> bool:
        if self.type == URL:
            return self.test_url(data)
        elif self.type == PATH:
            return self.test_frames(*munged_data)
        elif self.type == MODULE:
            return self.test_frames(find_stack_frames(data), ["module"])
        elif self.type.startswith("tags."):
            return self.test_tag(data)
        elif self.type == CODEOWNERS:
            return self.test_frames(
                *munged_data,
                # Codeowners has a slightly different syntax compared to issue owners
                # As such we need to match it using gitignore logic.
                # See syntax documentation here:
                # https://docs.github.com/en/github/creating-cloning-and-archiving-repositories/creating-a-repository-on-github/about-code-owners
                match_frame_value_func=lambda val, pattern: bool(codeowners_match(val, pattern)),
                match_frame_func=lambda frame: frame.get("in_app") is not False,
            )
        return False

    def test_url(self, data: Mapping[str, Any]) -> bool:
        url = get_path(data, "request", "url")
        return url and bool(glob_match(url, self.pattern, ignorecase=True))

    def test_frames(
        self,
        frames: Sequence[Mapping[str, Any]],
        keys: Sequence[str],
        match_frame_value_func: Callable[[str | None, str], bool] = lambda val, pattern: bool(
            glob_match(val, pattern, ignorecase=True, path_normalize=True)
        ),
        match_frame_func: Callable[[Mapping[str, Any]], bool] = lambda _: True,
    ) -> bool:
        for frame in frames:
            if not match_frame_func(frame):
                continue

            for key in keys:
                value = frame.get(key)
                if not value:
                    continue

                if match_frame_value_func(value, self.pattern):
                    return True

        return False

    def test_tag(self, data: Mapping[str, Any]) -> bool:
        tag = self.type[5:]

        # inspect the event-payload User interface first before checking tags.user
        if tag and tag.startswith("user."):
            for k, v in (get_path(data, "user", filter=True) or {}).items():
                if isinstance(v, str) and tag.endswith("." + k) and glob_match(v, self.pattern):
                    return True
                # user interface supports different fields in the payload, any other fields present gets put into the
                # 'data' dict
                # we look one more level deep to see if the pattern matches
                elif k == "data":
                    for data_k, data_v in (v or {}).items():
                        if (
                            isinstance(data_v, str)
                            and tag.endswith("." + data_k)
                            and glob_match(data_v, self.pattern)
                        ):
                            return True

        for k, v in get_path(data, "tags", filter=True) or ():
            if k == tag and glob_match(v, self.pattern):
                return True
            elif k == EventSubjectTemplateData.tag_aliases.get(tag, tag) and glob_match(
                v, self.pattern
            ):
                return True
        return False


class Owner(NamedTuple):
    """
    An Owner represents a User or Team who owns this Rule.

    type is either `user` or `team`.

    Examples:
        foo@example.com
        #team
    """

    type: str
    identifier: str

    def dump(self) -> dict[str, str]:
        return {"type": self.type, "identifier": self.identifier}

    @classmethod
    def load(cls, data: Mapping[str, str]) -> Owner:
        return cls(data["type"], data["identifier"])


class OwnershipVisitor(NodeVisitor):
    visit_comment = visit_empty = lambda *a: None

    def visit_ownership(self, node: Node, children: Sequence[Rule | None]) -> list[Rule]:
        return [_f for _f in children if _f]

    def visit_line(self, node: Node, children: tuple[Node, Sequence[Rule | None], Any]) -> Any:
        _, line, _ = children
        comment_or_rule_or_empty = line[0]
        if comment_or_rule_or_empty:
            return comment_or_rule_or_empty

    def visit_rule(self, node: Node, children: tuple[Node, Matcher, Sequence[Owner]]) -> Rule:
        _, matcher, owners = children
        return Rule(matcher, owners)

    def visit_matcher(self, node: Node, children: tuple[Node, str, str]) -> Matcher:
        _, tag, identifier = children
        return Matcher(tag, identifier)

    def visit_matcher_tag(self, node: Node, children: Sequence[Any]) -> str:
        if not children:
            return "path"
        (tag,) = children
        type, _ = tag
        return str(type[0].text)

    def visit_owners(self, node: Node, children: tuple[Any, Sequence[Owner]]) -> list[Owner]:
        _, owners = children
        return list(owners)

    def visit_owner(self, node: Node, children: tuple[Node, bool, str]) -> Owner:
        _, is_team, pattern = children
        type = "team" if is_team else "user"
        # User emails are case insensitive, so coerce them
        # to lowercase, so they can be de-duped, etc.
        if type == "user":
            pattern = pattern.lower()
        return Owner(type, pattern)

    def visit_team_prefix(self, node: Node, children: Sequence[Any]) -> bool:
        return bool(children)

    def visit_any_identifier(self, node: Node, children: Sequence[Any]) -> Node:
        return children[0]

    def visit_identifier(self, node: Node, children: Sequence[Any]) -> str:
        return str(node.text)

    def visit_quoted_identifier(self, node: Node, children: Sequence[Any]) -> str:
        return str(node.text[1:-1].encode("ascii", "backslashreplace").decode("unicode-escape"))

    def generic_visit(self, node: Node, children: Sequence[Any]) -> list[Node] | Node:
        return list(children) or node


def parse_rules(data: str) -> Any:
    """Convert a raw text input into a Rule tree"""
    tree = ownership_grammar.parse(data)
    return OwnershipVisitor().visit(tree)


def dump_schema(rules: Sequence[Rule]) -> dict[str, Any]:
    """Convert a Rule tree into a JSON schema"""
    return {"$version": VERSION, "rules": [r.dump() for r in rules]}


def load_schema(schema: Mapping[str, Any]) -> list[Rule]:
    """Convert a JSON schema into a Rule tree"""
    if schema["$version"] != VERSION:
        raise RuntimeError("Invalid schema $version: %r" % schema["$version"])
    return [Rule.load(r) for r in schema["rules"]]


def convert_schema_to_rules_text(schema: Mapping[str, Any]) -> str:
    rules = load_schema(schema)
    text = ""

    def owner_prefix(type: str) -> str:
        if type == "team":
            return "#"
        return ""

    for rule in rules:
        text += f"{rule.matcher.type}:{rule.matcher.pattern} {' '.join([f'{owner_prefix(owner.type)}{owner.identifier}' for owner in rule.owners])}\n"

    return text


def parse_code_owners(data: str) -> tuple[list[str], list[str], list[str]]:
    """Parse a CODEOWNERS text and returns the list of team names, list of usernames"""
    teams = []
    usernames = []
    emails = []
    for rule in data.splitlines():
        if rule.startswith("#") or not len(rule):
            continue

        # Skip lines that are only empty space characters
        if re.match(r"^\s*$", rule):
            continue

        _, assignees = get_codeowners_path_and_owners(rule)
        for assignee in assignees:
            if "/" not in assignee:
                if re.match(r"[^@]+@[^@]+\.[^@]+", assignee):
                    emails.append(assignee)
                else:
                    usernames.append(assignee)

            else:
                teams.append(assignee)

    return teams, usernames, emails


def get_codeowners_path_and_owners(rule: str) -> tuple[str, Sequence[str]]:
    # Regex does a negative lookbehind for a backslash. Matches on whitespace without a preceding backslash.
    pattern = re.compile(r"(?<!\\)\s")
    path, *code_owners = (i for i in pattern.split(rule.strip()) if i)

    # Find index of # in code_owners, assume everything after is a comment
    try:
        comment_index = code_owners.index("#")
        code_owners = code_owners[:comment_index]
    except ValueError:
        pass

    return path, code_owners


def convert_codeowners_syntax(
    codeowners: str, associations: Mapping[str, Any], code_mapping: RepositoryProjectPathConfig
) -> str:
    """Converts CODEOWNERS text into IssueOwner syntax
    codeowners: CODEOWNERS text
    associations: dict of {externalName: sentryName}
    code_mapping: RepositoryProjectPathConfig object
    """

    result = ""

    for rule in codeowners.splitlines():
        if rule.startswith("#") or not len(rule):
            # We want to preserve comments from CODEOWNERS
            result += f"{rule}\n"
            continue

        # Skip lines that are only empty space characters
        if re.match(r"^\s*$", rule):
            continue

        path, code_owners = get_codeowners_path_and_owners(rule)
        # Escape invalid paths https://docs.github.com/en/github/creating-cloning-and-archiving-repositories/creating-a-repository-on-github/about-code-owners#syntax-exceptions
        # Check if path has whitespace
        # Check if path has '#' not as first character
        # Check if path contains '!'
        # Check if path has a '[' followed by a ']'
        if re.search(r"(\[([^]^\s]*)\])|[\s!#]", path):
            continue

        sentry_assignees = []

        for owner in code_owners:
            try:
                sentry_assignees.append(associations[owner])
            except KeyError:
                # We allow users to upload an incomplete codeowner file,
                # meaning they may not have all the associations mapped.
                # If this is the case, we simply skip this line when
                # converting to issue owner syntax

                # TODO(meredith): log and/or collect analytics for when
                # we skip associations
                continue

        if sentry_assignees:
            # Replace source_root with stack_root for anchored paths
            # /foo/dir -> anchored
            # foo/dir -> anchored
            # foo/dir/ -> anchored
            # foo/ -> not anchored
            if re.search(r"[\/].{1}", path):
                path_with_stack_root = path.replace(
                    code_mapping.source_root, code_mapping.stack_root, 1
                )
                # flatten multiple '/' if not protocol
                formatted_path = re.sub(r"(?<!:)\/{2,}", "/", path_with_stack_root)
                result += f'codeowners:{formatted_path} {" ".join(sentry_assignees)}\n'
            else:
                result += f'codeowners:{path} {" ".join(sentry_assignees)}\n'

    return result


def resolve_actors(owners: Iterable[Owner], project_id: int) -> dict[Owner, Actor | None]:
    """Convert a list of Owner objects into a dictionary
    of {Owner: Actor} pairs. Actors not identified are returned
    as None."""
    from sentry.models.team import Team

    if not owners:
        return {}

    users, teams = [], []
    owners_lookup = {}

    for owner in owners:
        # teams aren't technical case insensitive, but teams also
        # aren't allowed to have non-lowercase in slugs, so
        # this kinda works itself out correctly since they won't match
        owners_lookup[(owner.type, owner.identifier.lower())] = owner
        if owner.type == "user":
            users.append(owner)
        elif owner.type == "team":
            teams.append(owner)

    actors = {}
    if users:
        owner_users = user_service.get_many(
            filter=dict(emails=[o.identifier for o in users], is_active=True)
        )
        in_project_user_ids = set(
            OrganizationMember.objects.filter(
                teams__projectteam__project__in=[project_id],
                user_id__in=[owner.id for owner in owner_users],
            ).values_list("user_id", flat=True)
        )
        rpc_users = [owner for owner in owner_users if owner.id in in_project_user_ids]

        user_id_email_tuples = set()
        for user in rpc_users:
            user_id_email_tuples.add((user.id, user.email))
            for useremail in user.useremails:
                user_id_email_tuples.add((user.id, useremail.email))

        actors.update(
            {
                ("user", email.lower()): Actor(id=u_id, actor_type=ActorType.USER)
                # This will need to be broken in hybrid cloud world, querying users from region silo won't be possible
                # without an explicit service call.
                for u_id, email in user_id_email_tuples
            }
        )

    if teams:
        actors.update(
            {
                ("team", slug): Actor(id=t_id, actor_type=ActorType.TEAM, slug=slug)
                for t_id, slug in Team.objects.filter(
                    slug__in=[o.identifier for o in teams], projectteam__project_id=project_id
                ).values_list("id", "slug")
            }
        )

    return {o: actors.get((o.type, o.identifier.lower())) for o in owners}


def remove_deleted_owners_from_schema(
    rules: list[dict[str, Any]], owners_id: dict[str, int]
) -> None:
    valid_rules = rules

    for rule in rules:
        valid_owners = rule["owners"]
        for rule_owner in rule["owners"]:
            if rule_owner["identifier"] not in owners_id.keys():
                valid_owners.remove(rule_owner)
                if not valid_owners:
                    valid_rules.remove(rule)
                    break

        rule["owners"] = valid_owners

    rules = valid_rules


def add_owner_ids_to_schema(rules: list[dict[str, Any]], owners_id: dict[str, int]) -> None:
    for rule in rules:
        for rule_owner in rule["owners"]:
            if rule_owner["identifier"] in owners_id.keys():
                rule_owner["id"] = owners_id[rule_owner["identifier"]]


def create_schema_from_issue_owners(
    project_id: int,
    issue_owners: str | None,
    add_owner_ids: bool = False,
    remove_deleted_owners: bool = False,
) -> dict[str, Any] | None:
    if issue_owners is None:
        return None

    try:
        rules = parse_rules(issue_owners)
    except ParseError as e:
        rule_name = e.expr.name if e.expr else str(e.expr)
        raise ValidationError(
            {"raw": f"Parse error: {rule_name} (line {e.line()}, column {e.column()})"}
        )

    schema = dump_schema(rules)

    owners = {o for rule in rules for o in rule.owners}
    owners_id = {}
    actors = resolve_actors(owners, project_id)

    bad_actors = []
    for owner, actor in actors.items():
        if actor is None:
            if owner.type == "user":
                bad_actors.append(owner.identifier)
            elif owner.type == "team":
                bad_actors.append(f"#{owner.identifier}")
        elif add_owner_ids:
            owners_id[owner.identifier] = actor.id

    if bad_actors and remove_deleted_owners:
        remove_deleted_owners_from_schema(schema["rules"], owners_id)
    elif bad_actors:
        bad_actors.sort()
        raise ValidationError({"raw": "Invalid rule owners: {}".format(", ".join(bad_actors))})

    if add_owner_ids:
        add_owner_ids_to_schema(schema["rules"], owners_id)

    return schema
