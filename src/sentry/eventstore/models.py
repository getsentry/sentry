from __future__ import annotations

import abc
import logging
import string
from collections.abc import Mapping, Sequence
from copy import deepcopy
from datetime import datetime, timezone
from hashlib import md5
from typing import TYPE_CHECKING, Any, Literal, Optional, cast, overload

import orjson
import sentry_sdk
from dateutil.parser import parse as parse_date
from django.conf import settings
from django.utils.encoding import force_str
from django.utils.functional import cached_property

from sentry import eventtypes
from sentry.db.models import NodeData
from sentry.grouping.variants import BaseVariant
from sentry.interfaces.base import Interface, get_interfaces
from sentry.issues.grouptype import GroupCategory
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models.event import EventDict
from sentry.snuba.events import Columns
from sentry.spans.grouping.api import load_span_grouping_config
from sentry.utils.safe import get_path, trim
from sentry.utils.strings import truncatechars

logger = logging.getLogger(__name__)

# Keys in the event payload we do not want to send to the event stream / snuba.
EVENTSTREAM_PRUNED_KEYS = ("debug_meta", "_meta")
# Keys in the event metadata we do not want to include in the event's `search_message`
SEARCH_MESSAGE_SKIPPED_KEYS = frozenset(["in_app_frame_mix"])

if TYPE_CHECKING:
    from sentry.grouping.api import GroupingConfig
    from sentry.grouping.strategies.base import StrategyConfiguration
    from sentry.interfaces.user import User
    from sentry.models.environment import Environment
    from sentry.models.group import Group
    from sentry.models.organization import Organization
    from sentry.models.project import Project
    from sentry.spans.grouping.result import SpanGroupingResults


def ref_func(x: Event) -> int:
    return x.project_id or x.project.id


class BaseEvent(metaclass=abc.ABCMeta):
    """
    Event backed by nodestore and Snuba.
    """

    def __init__(
        self,
        project_id: int,
        event_id: str,
        snuba_data: Mapping[str, Any] | None = None,
    ):
        self.project_id = project_id
        self.event_id = event_id
        self._snuba_data = snuba_data or {}

    def __getstate__(self) -> Mapping[str, Any]:
        state = self.__dict__.copy()
        # do not pickle cached info.  We want to fetch this on demand
        # again.
        state.pop("_project_cache", None)
        state.pop("_environment_cache", None)
        state.pop("_group_cache", None)
        state.pop("interfaces", None)

        return state

    @property
    @abc.abstractmethod
    def data(self) -> NodeData:
        pass

    @data.setter
    @abc.abstractmethod
    def data(self, value: NodeData | Mapping[str, Any]):
        pass

    @property
    def trace_id(self) -> str | None:
        ret_value = None
        if self.data:
            ret_value = self.data.get("contexts", {}).get("trace", {}).get("trace_id")
        return ret_value

    @property
    def platform(self) -> str | None:
        column = self._get_column_name(Columns.PLATFORM)
        if column in self._snuba_data:
            return cast(str, self._snuba_data[column])
        return cast(str, self.data.get("platform", None))

    @property
    def message(self) -> str:
        return (
            get_path(self.data, "logentry", "formatted")
            or get_path(self.data, "logentry", "message")
            or ""
        )

    @property
    def datetime(self) -> datetime:
        column = self._get_column_name(Columns.TIMESTAMP)
        if column in self._snuba_data:
            return parse_date(self._snuba_data[column]).replace(tzinfo=timezone.utc)

        timestamp = self.data["timestamp"]
        date = datetime.fromtimestamp(timestamp)
        date = date.replace(tzinfo=timezone.utc)
        return date

    @property
    def timestamp(self) -> str:
        column = self._get_column_name(Columns.TIMESTAMP)
        if column in self._snuba_data:
            return cast(str, self._snuba_data[column])
        return self.datetime.isoformat()

    @property
    def tags(self) -> Sequence[tuple[str, str]]:
        """
        Tags property uses tags from snuba if loaded otherwise falls back to
        nodestore.
        """
        tags_key_column = self._get_column_name(Columns.TAGS_KEY)
        tags_value_column = self._get_column_name(Columns.TAGS_VALUE)

        if tags_key_column in self._snuba_data and tags_value_column in self._snuba_data:
            keys = self._snuba_data[tags_key_column]
            values = self._snuba_data[tags_value_column]
            if keys and values and len(keys) == len(values):
                return sorted(zip(keys, values))
            else:
                return []
        # Nodestore implementation
        try:
            rv = sorted(
                (t, v)
                for t, v in get_path(self.data, "tags", filter=True) or ()
                if t is not None and v is not None
            )
            return rv
        except ValueError:
            # at one point Sentry allowed invalid tag sets such as (foo, bar)
            # vs ((tag, foo), (tag, bar))
            return []

    def get_tag(self, key: str) -> str | None:
        for t, v in self.tags:
            if t == key:
                return v
        return None

    @property
    def release(self) -> str | None:
        return self.get_tag("sentry:release")

    @property
    def dist(self) -> str | None:
        return self.get_tag("sentry:dist")

    @property
    def transaction(self) -> str | None:
        return self.get_tag("transaction")

    def get_environment(self) -> Environment:
        from sentry.models.environment import Environment

        if not hasattr(self, "_environment_cache"):
            self._environment_cache = Environment.objects.get(
                organization_id=self.project.organization_id,
                name=Environment.get_name_or_default(self.get_tag("environment")),
            )

        return self._environment_cache

    def get_minimal_user(self) -> User:
        """
        A minimal 'User' interface object that gives us enough information
        to render a user badge.
        """
        from sentry.interfaces.user import User

        user_id_column = self._get_column_name(Columns.USER_ID)
        user_email_column = self._get_column_name(Columns.USER_EMAIL)
        user_username_column = self._get_column_name(Columns.USER_USERNAME)
        user_ip_address_column = self._get_column_name(Columns.USER_IP_ADDRESS)

        if all(
            key in self._snuba_data
            for key in [
                user_id_column,
                user_email_column,
                user_username_column,
                user_ip_address_column,
            ]
        ):
            user_id = self._snuba_data[user_id_column]
            email = self._snuba_data[user_email_column]
            username = self._snuba_data[user_username_column]
            ip_address = self._snuba_data[user_ip_address_column]

            return User.to_python(
                {"id": user_id, "email": email, "username": username, "ip_address": ip_address}
            )

        return self.get_interface("user")

    def get_event_type(self) -> str:
        """
        Return the type of this event.

        See ``sentry.eventtypes``.
        """
        column = self._get_column_name(Columns.TYPE)
        if column in self._snuba_data:
            return cast(str, self._snuba_data[column])
        return cast(str, self.data.get("type", "default"))

    @property
    def ip_address(self) -> str | None:
        column = self._get_column_name(Columns.USER_IP_ADDRESS)
        if column in self._snuba_data:
            return cast(str, self._snuba_data[column])

        ip_address = get_path(self.data, "user", "ip_address")
        if ip_address:
            return cast(str, ip_address)

        remote_addr = get_path(self.data, "request", "env", "REMOTE_ADDR")
        if remote_addr:
            return cast(str, remote_addr)

        return None

    @property
    def title(self) -> str:
        column = self._get_column_name(Columns.TITLE)
        if column in self._snuba_data:
            return cast(str, self._snuba_data[column])

        title = self.data.get("title")
        event_type = self.get_event_type()

        # TODO: It may be that we don't have to restrict this to just default and error types
        if title and event_type in ["default", "error"]:
            return title

        event_type_instance = eventtypes.get(event_type)()
        return cast(str, event_type_instance.get_title(self.get_event_metadata()))

    @property
    def culprit(self) -> str | None:
        column = self._get_column_name(Columns.CULPRIT)
        if column in self._snuba_data:
            return cast(str, self._snuba_data[column])
        return cast(Optional[str], self.data.get("culprit"))

    @property
    def location(self) -> str | None:
        column = self._get_column_name(Columns.LOCATION)
        if column in self._snuba_data:
            return cast(str, self._snuba_data[column])
        et = eventtypes.get(self.get_event_type())()
        return cast(Optional[str], et.get_location(self.get_event_metadata()))

    @classmethod
    def generate_node_id(cls, project_id: int, event_id: str) -> str:
        """
        Returns a deterministic node_id for this event based on the project_id
        and event_id which together are globally unique. The event body should
        be saved under this key in nodestore so it can be retrieved using the
        same generated id when we only have project_id and event_id.
        """
        return md5(f"{project_id}:{event_id}".encode()).hexdigest()

    @property
    def project(self) -> Project:
        from sentry.models.project import Project

        if not hasattr(self, "_project_cache"):
            self._project_cache = Project.objects.get(id=self.project_id)
        return self._project_cache

    @project.setter
    def project(self, project: Project) -> None:
        self.project_id = project.id
        self._project_cache = project

    @cached_property
    def interfaces(self) -> Mapping[str, Interface]:
        return get_interfaces(self.data)

    @overload
    def get_interface(self, name: Literal["user"]) -> User: ...

    @overload
    def get_interface(self, name: str) -> Interface | None: ...

    def get_interface(self, name: str) -> Interface | None:
        return self.interfaces.get(name)

    def get_event_metadata(self) -> dict[str, Any]:
        """
        Return the metadata of this event.

        See ``sentry.eventtypes``.
        """
        # For some inexplicable reason we have some cases where the data
        # is completely empty.  In that case we want to hobble along
        # further.
        return self.data.get("metadata") or {}

    def get_grouping_config(self) -> GroupingConfig:
        """Returns the event grouping config."""
        from sentry.grouping.api import get_grouping_config_dict_for_event_data

        return get_grouping_config_dict_for_event_data(self.data, self.project)

    def get_hashes_and_variants(
        self, config: StrategyConfiguration | None = None
    ) -> tuple[list[str], dict[str, BaseVariant]]:
        """
        Return the event's hash values, calculated using the given config, along with the
        `variants` data used in grouping.
        """

        variants = self.get_grouping_variants(config)
        hashes_by_variant = {
            variant_name: variant.get_hash() for variant_name, variant in variants.items()
        }

        # Sort the variants so that the system variant (if any) is always last, in order to resolve
        # ambiguities when choosing primary_hash for Snuba
        sorted_variant_names = sorted(
            variants,
            key=lambda variant_name: 1 if variant_name == "system" else 0,
        )

        # Get each variant's hash value, filtering out Nones
        hashes = [
            h
            for h in (hashes_by_variant[variant_name] for variant_name in sorted_variant_names)
            if h is not None
        ]

        # Write to event before returning
        self.data["hashes"] = hashes

        return (hashes, variants)

    def get_hashes(self, force_config: StrategyConfiguration | None = None) -> list[str]:
        """
        Returns the calculated hashes for the event. This uses the stored
        information if available. Grouping hashes will take into account
        fingerprinting and checksums.

        Returns _all_ information that is necessary to group an event into
        issues: An event should be sorted into a group X, if there is a GroupHash
        matching *any* of the hashes. Hashes that do not yet have a GroupHash model get
        one and are associated with the same group (unless they already belong to another group).

        """
        # If we have hashes stored in the data we use them, otherwise we
        # fall back to generating new ones from the data.  We can only use
        # this if we do not force a different config.
        if force_config is None:
            hashes = self.data.get("hashes")
            if hashes is not None:
                return hashes

        # Create fresh hashes
        return self.get_hashes_and_variants(force_config)[0]

    def normalize_stacktraces_for_grouping(self, grouping_config: StrategyConfiguration) -> None:
        """Normalize stacktraces and clear memoized interfaces

        See stand-alone function normalize_stacktraces_for_grouping
        """
        from sentry.stacktraces.processing import normalize_stacktraces_for_grouping

        normalize_stacktraces_for_grouping(self.data, grouping_config)

        # We have modified event data, so any cached interfaces have to be reset:
        self.__dict__.pop("interfaces", None)

    def get_grouping_variants(
        self,
        force_config: StrategyConfiguration | GroupingConfig | str | None = None,
        normalize_stacktraces: bool = False,
    ) -> dict[str, BaseVariant]:
        """
        This is similar to `get_hashes` but will instead return the
        grouping components for each variant in a dictionary.

        If `normalize_stacktraces` is set to `True` then the event data will be
        modified for `in_app` in addition to event variants being created.  This
        means that after calling that function the event data has been modified
        in place.
        """
        from sentry.grouping.api import get_grouping_variants_for_event, load_grouping_config

        # Forcing configs has two separate modes.  One is where just the
        # config ID is given in which case it's merged with the stored or
        # default config dictionary
        if force_config is not None:
            from sentry.grouping.strategies.base import StrategyConfiguration

            if isinstance(force_config, str):
                # A string like `"newstyle:YYYY-MM-DD"`
                stored_config = self.get_grouping_config()
                grouping_config = stored_config.copy()
                grouping_config["id"] = force_config
                loaded_grouping_config = load_grouping_config(grouping_config)
            elif isinstance(force_config, StrategyConfiguration):
                # A fully initialized `StrategyConfiguration`
                loaded_grouping_config = force_config
            else:
                # A `GroupingConfig` dictionary
                loaded_grouping_config = load_grouping_config(force_config)
        # Otherwise we just use the same grouping config as stored.  if
        # this is None we use the project's default config.
        else:
            grouping_config = self.get_grouping_config()
            loaded_grouping_config = load_grouping_config(grouping_config)

        if normalize_stacktraces:
            with sentry_sdk.start_span(op="grouping.normalize_stacktraces_for_grouping") as span:
                span.set_tag("project", self.project_id)
                span.set_tag("event_id", self.event_id)
                self.normalize_stacktraces_for_grouping(loaded_grouping_config)

        with sentry_sdk.start_span(op="grouping.get_grouping_variants") as span:
            span.set_tag("project", self.project_id)
            span.set_tag("event_id", self.event_id)

            return get_grouping_variants_for_event(self, loaded_grouping_config)

    def get_primary_hash(self) -> str:
        return self.get_hashes()[0]

    def get_span_groupings(
        self, force_config: str | Mapping[str, Any] | None = None
    ) -> SpanGroupingResults:
        config = load_span_grouping_config(force_config)
        return config.execute_strategy(self.data)

    @property
    def organization(self) -> Organization:
        return self.project.organization

    @property
    def version(self) -> str:
        return cast(str, self.data.get("version", "5"))

    def get_raw_data(self, for_stream: bool = False) -> Mapping[str, Any]:
        """Returns the internal raw event data dict."""
        rv = dict(self.data.items())
        # If we get raw data for snuba we remove some large keys that blow
        # up the payload for no reason.
        if for_stream:
            for key in EVENTSTREAM_PRUNED_KEYS:
                rv.pop(key, None)
        return rv

    @property
    def size(self) -> int:
        return len(orjson.dumps(dict(self.data)).decode())

    def get_email_subject(self) -> str:
        template = self.project.get_option("mail:subject_template")
        if template:
            template = EventSubjectTemplate(template)
        elif self.group.issue_category == GroupCategory.PERFORMANCE:
            template = EventSubjectTemplate("$shortID - $issueType")
        else:
            template = DEFAULT_SUBJECT_TEMPLATE
        return cast(
            str, truncatechars(template.safe_substitute(EventSubjectTemplateData(self)), 128)
        )

    def as_dict(self) -> dict[str, Any]:
        """Returns the data in normalized form for external consumers."""
        data: dict[str, Any] = {}
        data["event_id"] = self.event_id
        data["project"] = self.project_id
        data["release"] = self.release
        data["dist"] = self.dist
        data["platform"] = self.platform
        data["message"] = self.message
        data["datetime"] = self.datetime
        data["tags"] = [(k.split("sentry:", 1)[-1], v) for (k, v) in self.tags]
        for k, v in sorted(self.data.items()):
            if k in data:
                continue
            if k == "sdk":
                v = {v_k: v_v for v_k, v_v in v.items() if v_k != "client_ip"}
            data[k] = v

        # for a long time culprit was not persisted.  In those cases put
        # the culprit in from the group.
        if data.get("culprit") is None and self.group_id and self.group:
            data["culprit"] = self.group.culprit

        # Override title and location with dynamically generated data
        data["title"] = self.title
        data["location"] = self.location

        return data

    @cached_property
    def search_message(self) -> str:
        """
        The internal search_message attribute is only used for search purposes.
        It adds a bunch of data from the metadata and the culprit.
        """
        data = self.data
        culprit = self.culprit

        event_metadata = self.get_event_metadata()

        if event_metadata is None:
            event_metadata = eventtypes.get(self.get_event_type())().get_metadata(self.data)

        message = ""

        if data.get("logentry"):
            message += data["logentry"].get("formatted") or data["logentry"].get("message") or ""

        if event_metadata:
            for key, value in event_metadata.items():
                if key in SEARCH_MESSAGE_SKIPPED_KEYS or isinstance(value, (bool, int, float)):
                    continue

                value_u = force_str(value, errors="replace")
                if value_u not in message:
                    message = f"{message} {value_u}"

        if culprit and culprit not in message:
            culprit_u = force_str(culprit, errors="replace")
            message = f"{message} {culprit_u}"

        return cast(str, trim(message.strip(), settings.SENTRY_MAX_MESSAGE_LENGTH))

    def _get_column_name(self, column: Columns) -> str:
        # Events are currently populated from the Events dataset
        return cast(str, column.value.event_name)

    @property
    def should_skip_seer(self) -> bool:
        """
        A convenience property to allow us to skip calling Seer in cases where there's been a race
        condition and multiple events with the same new grouphash are going through ingestion
        simultaneously. When we detect that, we can set this property on events that lose the race,
        so that only the one event which wins the race gets sent to Seer.

        (The race-losers may not be able to store Seer results in any case, as the race condition
        means their `metadata` properties may not point to real database records.)

        Doing this reduces the load on Seer and also helps protect projects from hitting their Seer
        rate limit.
        """
        try:
            return self._should_skip_seer
        except AttributeError:
            return False

    @should_skip_seer.setter
    def should_skip_seer(self, should_skip: bool) -> None:
        self._should_skip_seer = should_skip


class Event(BaseEvent):
    def __init__(
        self,
        project_id: int,
        event_id: str,
        group_id: int | None = None,
        data: Mapping[str, Any] | None = None,
        snuba_data: Mapping[str, Any] | None = None,
        groups: Sequence[Group] | None = None,
    ):
        super().__init__(project_id, event_id, snuba_data=snuba_data)
        self.group_id = group_id
        self.groups = groups
        self.data = data

    def __getstate__(self) -> Mapping[str, Any]:
        state = super().__getstate__()
        state.pop("_group_cache", None)
        state.pop("_groups_cache", None)
        return state

    def __repr__(self):
        return "<sentry.eventstore.models.Event at 0x{:x}: event_id={}>".format(
            id(self), self.event_id
        )

    @property
    def data(self) -> NodeData:
        return self._data

    @data.setter
    def data(self, value: Mapping[str, Any]) -> None:
        node_id = Event.generate_node_id(self.project_id, self.event_id)
        self._data = NodeData(
            node_id, data=value, wrapper=EventDict, ref_version=2, ref_func=ref_func
        )

    @property
    def group_id(self) -> int | None:
        # TODO: `group_id` and `group` are deprecated properties on `Event`. We will remove them
        # going forward. Since events may now be associated with multiple `Group` models, we will
        # require `GroupEvent` to be passed around. The `group_events` property should be used to
        # iterate through all `Groups` associated with an `Event`
        if self._group_id:
            return self._group_id

        column = self._get_column_name(Columns.GROUP_ID)

        return self._snuba_data.get(column)

    @group_id.setter
    def group_id(self, value: int | None) -> None:
        self._group_id = value

    # TODO: We need a better way to cache these properties. functools
    # doesn't quite do the trick as there is a reference bug with unsaved
    # models. But the current _group_cache thing is also clunky because these
    # properties need to be stripped out in __getstate__.
    @property
    def group(self) -> Group | None:
        from sentry.models.group import Group

        if not self.group_id:
            return None
        if not hasattr(self, "_group_cache"):
            self._group_cache = Group.objects.get(id=self.group_id)
        return self._group_cache

    @group.setter
    def group(self, group: Group) -> None:
        self.group_id = group.id
        self._group_cache = group

    _groups_cache: Sequence[Group]

    @property
    def groups(self) -> Sequence[Group]:
        from sentry.models.group import Group

        if getattr(self, "_groups_cache"):
            return self._groups_cache

        if self._group_ids is not None:
            group_ids = self._group_ids
        else:
            snuba_group_id = self.group_id
            # TODO: Replace `snuba_group_id` with this once we deprecate `group_id`.
            # snuba_group_id = self._snuba_data.get(self._get_column_name(Columns.GROUP_ID))
            snuba_group_ids = self._snuba_data.get(self._get_column_name(Columns.GROUP_IDS))
            group_ids = []
            if snuba_group_id:
                group_ids.append(snuba_group_id)
            if snuba_group_ids:
                group_ids.extend(snuba_group_ids)

        if group_ids:
            groups = list(Group.objects.filter(id__in=group_ids))
        else:
            groups = []

        self._groups_cache = groups
        return groups

    @groups.setter
    def groups(self, values: Sequence[Group] | None):
        self._groups_cache = values
        self._group_ids = [group.id for group in values] if values else None

    def for_group(self, group: Group) -> GroupEvent:
        return GroupEvent.from_event(self, group)


class GroupEvent(BaseEvent):
    def __init__(
        self,
        project_id: int,
        event_id: str,
        group: Group,
        data: NodeData,
        snuba_data: Mapping[str, Any] | None = None,
        occurrence: IssueOccurrence | None = None,
    ) -> None:
        super().__init__(project_id, event_id, snuba_data=snuba_data)
        self.group = group
        self.data = data
        self._occurrence = occurrence

    def __eq__(self, other):
        if not isinstance(other, GroupEvent):
            return False
        return other.event_id == self.event_id and other.group_id == self.group_id

    def __hash__(self):
        return hash((self.group_id, self.event_id))

    @property
    def group_id(self) -> int:
        # TODO: Including this as a shim for now. I think it makes sense to remove this helper,
        # since people may as well use `group.id` instead of `group_id`, but it breaks a lot of
        # compatibility with `Event`. Including this here for now so that we don't have to rewrite
        # the whole codebase at once.
        return self.group.id

    @property
    def data(self) -> NodeData:
        return self._data

    @data.setter
    def data(self, value: NodeData) -> None:
        self._data = value

    @classmethod
    def from_event(cls, event: Event, group: Group) -> GroupEvent:
        group_event = cls(
            project_id=event.project_id,
            event_id=event.event_id,
            group=group,
            data=deepcopy(event.data),
            snuba_data=deepcopy(event._snuba_data),
        )
        if hasattr(event, "_project_cache"):
            group_event.project = event.project
        return group_event

    @property
    def occurrence(self) -> IssueOccurrence | None:
        if not self._occurrence and self.occurrence_id:
            self._occurrence = IssueOccurrence.fetch(self.occurrence_id, self.project_id)
            if self._occurrence is None:
                logger.error(
                    "Failed to fetch occurrence for event",
                    extra={"group_id": self.group_id, "occurrence_id": self.occurrence_id},
                )

        return self._occurrence

    @occurrence.setter
    def occurrence(self, value: IssueOccurrence) -> None:
        self._occurrence = value

    @property
    def occurrence_id(self) -> str | None:
        if self._occurrence:
            return self.occurrence.id

        column = self._get_column_name(Columns.OCCURRENCE_ID)
        if column in self._snuba_data:
            return cast(str, self._snuba_data[column])
        return None

    @cached_property
    def search_message(self) -> str:
        message = super().search_message
        # Include values from the occurrence in our search message as well, so that occurrences work
        # correctly in search.
        if self.occurrence is not None:
            message = augment_message_with_occurrence(message, self.occurrence)

        return message


def augment_message_with_occurrence(message: str, occurrence: IssueOccurrence) -> str:
    for attr in ("issue_title", "subtitle", "culprit"):
        value = getattr(occurrence, attr, "")
        if value and value not in message:
            value = force_str(value, errors="replace")
            message = f"{message} {value}"
    return message


class EventSubjectTemplate(string.Template):
    idpattern = r"(tag:)?[_a-z][_a-z0-9]*"


class EventSubjectTemplateData:
    tag_aliases = {"release": "sentry:release", "dist": "sentry:dist", "user": "sentry:user"}

    def __init__(self, event: Event):
        self.event = event

    def __getitem__(self, name: str) -> str:
        if name.startswith("tag:"):
            name = name[4:]
            value = self.event.get_tag(self.tag_aliases.get(name, name))
            if value is None:
                value = self.event.get_tag(name)

            if value is None:
                raise KeyError
            return str(value)
        elif name == "project":
            return cast(str, self.event.project.get_full_name())
        elif name == "projectID":
            return cast(str, self.event.project.slug)
        elif name == "shortID" and self.event.group_id and self.event.group:
            return cast(str, self.event.group.qualified_short_id)
        elif name == "orgID":
            return self.event.organization.slug
        elif name == "title":
            if getattr(self.event, "occurrence", None):
                return self.event.occurrence.issue_title
            else:
                return self.event.title

        elif name == "issueType":
            return self.event.group.issue_type.description
        raise KeyError


DEFAULT_SUBJECT_TEMPLATE = EventSubjectTemplate("$shortID - $title")
