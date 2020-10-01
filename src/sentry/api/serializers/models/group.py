from __future__ import absolute_import, print_function

import functools
import itertools
from collections import defaultdict
from datetime import datetime, timedelta

import six
import pytz
import logging

from django.conf import settings
from django.db.models import Min, Q
from django.utils import timezone

import sentry_sdk

from sentry import tagstore, tsdb, features
from sentry.app import env
from sentry.api.event_search import convert_search_filter_to_snuba_query
from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.actor import ActorSerializer
from sentry.api.fields.actor import Actor
from sentry.auth.superuser import is_active_superuser
from sentry.constants import LOG_LEVELS, StatsPeriod
from sentry.models import (
    ApiToken,
    Commit,
    Environment,
    Group,
    GroupAssignee,
    GroupBookmark,
    GroupEnvironment,
    GroupLink,
    GroupMeta,
    GroupResolution,
    GroupSeen,
    GroupSnooze,
    GroupShare,
    GroupStatus,
    GroupSubscription,
    GroupSubscriptionReason,
    Integration,
    SentryAppInstallationToken,
    User,
    UserOption,
    UserOptionValue,
    Organization,
)
from sentry.tagstore.snuba.backend import fix_tag_value_data
from sentry.tsdb.snuba import SnubaTSDB
from sentry.utils import snuba
from sentry.utils.db import attach_foreignkey
from sentry.utils.safe import safe_execute
from sentry.utils.compat import map, zip
from sentry.utils.snuba import Dataset, raw_query

SUBSCRIPTION_REASON_MAP = {
    GroupSubscriptionReason.comment: "commented",
    GroupSubscriptionReason.assigned: "assigned",
    GroupSubscriptionReason.bookmark: "bookmarked",
    GroupSubscriptionReason.status_change: "changed_status",
    GroupSubscriptionReason.mentioned: "mentioned",
}


disabled = object()


# TODO(jess): remove when snuba is primary backend
snuba_tsdb = SnubaTSDB(**settings.SENTRY_TSDB_OPTIONS)


logger = logging.getLogger(__name__)


def merge_list_dictionaries(dict1, dict2):
    for key, val in six.iteritems(dict2):
        dict1.setdefault(key, []).extend(val)


class GroupSerializerBase(Serializer):
    def _get_seen_stats(self, item_list, user):
        """
        Returns a dictionary keyed by item that includes:
            - times_seen
            - first_seen
            - last_seen
            - user_count
        """
        raise NotImplementedError

    def _get_group_snuba_stats(self, item_list, seen_stats):
        filter_keys = {}

        # Try to figure out what is a reasonable time frame to look into stats,
        # based on a given "seen stats".  We try to pick a day prior to the earliest last seen,
        # but it has to be at least 14 days, and not more than 90 days ago.
        # Fallback to the 30 days ago if we are not able to calculate the value.
        last_seen = None
        for item in seen_stats.values():
            if last_seen is None or last_seen > item["last_seen"]:
                last_seen = item["last_seen"]
        if last_seen is not None:
            last_seen = last_seen - timedelta(days=1)

        if last_seen is None:
            start = datetime.now(pytz.utc) - timedelta(days=30)
        else:
            start = max(
                min(last_seen, datetime.now(pytz.utc) - timedelta(days=14)),
                datetime.now(pytz.utc) - timedelta(days=90),
            )

        for item in item_list:
            filter_keys.setdefault("project_id", []).append(item.project_id)
            filter_keys.setdefault("group_id", []).append(item.id)

        rv = raw_query(
            dataset=Dataset.Events,
            selected_columns=[
                "group_id",
                ["has", ["exception_stacks.mechanism_handled", 0], "unhandled"],
            ],
            filter_keys=filter_keys,
            start=start,
        )

        return dict((x["group_id"], {"unhandled": x["unhandled"]}) for x in rv["data"])

    def _get_subscriptions(self, item_list, user):
        """
        Returns a mapping of group IDs to a two-tuple of (subscribed: bool,
        subscription: GroupSubscription or None) for the provided user and
        groups.
        """
        if not item_list:
            return {}

        # Collect all of the projects to look up, and keep a set of groups that
        # are part of that project. (Note that the common -- but not only --
        # case here is that all groups are part of the same project.)
        projects = defaultdict(set)
        for group in item_list:
            projects[group.project].add(group)

        # Fetch the options for each project -- we'll need this to identify if
        # a user has totally disabled workflow notifications for a project.
        # NOTE: This doesn't use `values_list` because that bypasses field
        # value decoding, so the `value` field would not be unpickled.
        options = {
            option.project_id: option.value
            for option in UserOption.objects.filter(
                Q(project__in=projects.keys()) | Q(project__isnull=True),
                user=user,
                key="workflow:notifications",
            )
        }

        # If there is a subscription record associated with the group, we can
        # just use that to know if a user is subscribed or not, as long as
        # notifications aren't disabled for the project.
        subscriptions = {
            subscription.group_id: subscription
            for subscription in GroupSubscription.objects.filter(
                group__in=list(
                    itertools.chain.from_iterable(
                        map(
                            lambda project__groups: project__groups[1]
                            if not options.get(project__groups[0].id, options.get(None))
                            == UserOptionValue.no_conversations
                            else [],
                            projects.items(),
                        )
                    )
                ),
                user=user,
            )
        }

        # This is the user's default value for any projects that don't have
        # the option value specifically recorded. (The default
        # "participating_only" value is convention.)
        global_default_workflow_option = options.get(None, UserOptionValue.participating_only)

        results = {}
        for project, groups in projects.items():
            project_default_workflow_option = options.get(
                project.id, global_default_workflow_option
            )
            for group in groups:
                subscription = subscriptions.get(group.id)
                if subscription is not None:
                    results[group.id] = (subscription.is_active, subscription)
                else:
                    results[group.id] = (
                        (project_default_workflow_option == UserOptionValue.all_conversations, None)
                        if project_default_workflow_option != UserOptionValue.no_conversations
                        else disabled
                    )

        return results

    def get_attrs(self, item_list, user):
        from sentry.plugins.base import plugins
        from sentry.integrations import IntegrationFeatures
        from sentry.models import PlatformExternalIssue

        GroupMeta.objects.populate_cache(item_list)

        attach_foreignkey(item_list, Group.project)

        if user.is_authenticated() and item_list:
            bookmarks = set(
                GroupBookmark.objects.filter(user=user, group__in=item_list).values_list(
                    "group_id", flat=True
                )
            )
            seen_groups = dict(
                GroupSeen.objects.filter(user=user, group__in=item_list).values_list(
                    "group_id", "last_seen"
                )
            )
            subscriptions = self._get_subscriptions(item_list, user)
        else:
            bookmarks = set()
            seen_groups = {}
            subscriptions = defaultdict(lambda: (False, None))

        assignees = {
            a.group_id: a.assigned_actor()
            for a in GroupAssignee.objects.filter(group__in=item_list)
        }
        resolved_assignees = Actor.resolve_dict(assignees)

        ignore_items = {g.group_id: g for g in GroupSnooze.objects.filter(group__in=item_list)}

        resolved_item_list = [i for i in item_list if i.status == GroupStatus.RESOLVED]
        if resolved_item_list:
            release_resolutions = {
                i[0]: i[1:]
                for i in GroupResolution.objects.filter(group__in=resolved_item_list).values_list(
                    "group", "type", "release__version", "actor_id"
                )
            }

            # due to our laziness, and django's inability to do a reasonable join here
            # we end up with two queries
            commit_results = list(
                Commit.objects.extra(
                    select={"group_id": "sentry_grouplink.group_id"},
                    tables=["sentry_grouplink"],
                    where=[
                        "sentry_grouplink.linked_id = sentry_commit.id",
                        "sentry_grouplink.group_id IN ({})".format(
                            ", ".join(six.text_type(i.id) for i in resolved_item_list)
                        ),
                        "sentry_grouplink.linked_type = %s",
                        "sentry_grouplink.relationship = %s",
                    ],
                    params=[int(GroupLink.LinkedType.commit), int(GroupLink.Relationship.resolves)],
                )
            )
            commit_resolutions = {
                i.group_id: d for i, d in zip(commit_results, serialize(commit_results, user))
            }
        else:
            release_resolutions = {}
            commit_resolutions = {}

        actor_ids = set(r[-1] for r in six.itervalues(release_resolutions))
        actor_ids.update(r.actor_id for r in six.itervalues(ignore_items))
        if actor_ids:
            users = list(User.objects.filter(id__in=actor_ids, is_active=True))
            actors = {u.id: d for u, d in zip(users, serialize(users, user))}
        else:
            actors = {}

        share_ids = dict(
            GroupShare.objects.filter(group__in=item_list).values_list("group_id", "uuid")
        )

        result = {}

        seen_stats = self._get_seen_stats(item_list, user)

        annotations_by_group_id = defaultdict(list)

        organization_id_list = list(set(item.project.organization_id for item in item_list))
        # if no groups, then we can't proceed but this seems to be a valid use case
        if not item_list:
            return {}
        if len(organization_id_list) > 1:
            # this should never happen but if it does we should know about it
            logger.warn(
                u"Found multiple organizations for groups: %s, with orgs: %s"
                % ([item.id for item in item_list], organization_id_list)
            )

        # should only have 1 org at this point
        organization_id = organization_id_list[0]
        organization = Organization.objects.get_from_cache(id=organization_id)

        has_unhandled_flag = features.has(
            "organizations:unhandled-issue-flag", organization, actor=user
        )

        # find all the integration installs that have issue tracking
        for integration in Integration.objects.filter(organizations=organization_id):
            if not (
                integration.has_feature(IntegrationFeatures.ISSUE_BASIC)
                or integration.has_feature(IntegrationFeatures.ISSUE_SYNC)
            ):
                continue

            install = integration.get_installation(organization_id)
            local_annotations_by_group_id = (
                safe_execute(
                    install.get_annotations_for_group_list,
                    group_list=item_list,
                    _with_transaction=False,
                )
                or {}
            )
            merge_list_dictionaries(annotations_by_group_id, local_annotations_by_group_id)

        # find the external issues for sentry apps and add them in
        local_annotations_by_group_id = (
            safe_execute(
                PlatformExternalIssue.get_annotations_for_group_list,
                group_list=item_list,
                _with_transaction=False,
            )
            or {}
        )
        merge_list_dictionaries(annotations_by_group_id, local_annotations_by_group_id)

        snuba_stats = self._get_group_snuba_stats(item_list, seen_stats)

        for item in item_list:
            active_date = item.active_at or item.first_seen

            annotations = []
            annotations.extend(annotations_by_group_id[item.id])

            # add the annotations for plugins
            # note that the model GroupMeta where all the information is stored is already cached at the top of this function
            # so these for loops doesn't make a bunch of queries
            for plugin in plugins.for_project(project=item.project, version=1):
                safe_execute(plugin.tags, None, item, annotations, _with_transaction=False)
            for plugin in plugins.for_project(project=item.project, version=2):
                annotations.extend(
                    safe_execute(plugin.get_annotations, group=item, _with_transaction=False) or ()
                )

            resolution_actor = None
            resolution_type = None
            resolution = release_resolutions.get(item.id)
            if resolution:
                resolution_type = "release"
                resolution_actor = actors.get(resolution[-1])
            if not resolution:
                resolution = commit_resolutions.get(item.id)
                if resolution:
                    resolution_type = "commit"

            ignore_item = ignore_items.get(item.id)
            if ignore_item:
                ignore_actor = actors.get(ignore_item.actor_id)
            else:
                ignore_actor = None

            result[item] = {
                "assigned_to": resolved_assignees.get(item.id),
                "is_bookmarked": item.id in bookmarks,
                "subscription": subscriptions[item.id],
                "has_seen": seen_groups.get(item.id, active_date) > active_date,
                "annotations": annotations,
                "ignore_until": ignore_item,
                "ignore_actor": ignore_actor,
                "resolution": resolution,
                "resolution_type": resolution_type,
                "resolution_actor": resolution_actor,
                "share_id": share_ids.get(item.id),
            }

            if has_unhandled_flag:
                result[item]["is_unhandled"] = bool(snuba_stats.get(item.id, {}).get("unhandled"))

            result[item].update(seen_stats.get(item, {}))
        return result

    def _get_status(self, attrs, obj):
        status = obj.status
        status_details = {}
        if attrs["ignore_until"]:
            snooze = attrs["ignore_until"]
            if snooze.is_valid(group=obj):
                # counts return the delta remaining when window is not set
                status_details.update(
                    {
                        "ignoreCount": (
                            snooze.count - (obj.times_seen - snooze.state["times_seen"])
                            if snooze.count and not snooze.window
                            else snooze.count
                        ),
                        "ignoreUntil": snooze.until,
                        "ignoreUserCount": (
                            snooze.user_count - (attrs["user_count"] - snooze.state["users_seen"])
                            if snooze.user_count and not snooze.user_window
                            else snooze.user_count
                        ),
                        "ignoreUserWindow": snooze.user_window,
                        "ignoreWindow": snooze.window,
                        "actor": attrs["ignore_actor"],
                    }
                )
            else:
                status = GroupStatus.UNRESOLVED
        if status == GroupStatus.UNRESOLVED and obj.is_over_resolve_age():
            status = GroupStatus.RESOLVED
            status_details["autoResolved"] = True
        if status == GroupStatus.RESOLVED:
            status_label = "resolved"
            if attrs["resolution_type"] == "release":
                res_type, res_version, _ = attrs["resolution"]
                if res_type in (GroupResolution.Type.in_next_release, None):
                    status_details["inNextRelease"] = True
                elif res_type == GroupResolution.Type.in_release:
                    status_details["inRelease"] = res_version
                status_details["actor"] = attrs["resolution_actor"]
            elif attrs["resolution_type"] == "commit":
                status_details["inCommit"] = attrs["resolution"]
        elif status == GroupStatus.IGNORED:
            status_label = "ignored"
        elif status in [GroupStatus.PENDING_DELETION, GroupStatus.DELETION_IN_PROGRESS]:
            status_label = "pending_deletion"
        elif status == GroupStatus.PENDING_MERGE:
            status_label = "pending_merge"
        else:
            status_label = "unresolved"
        return status_details, status_label

    def _get_permalink(self, obj, user):
        # If user is not logged in and member of the organization,
        # do not return the permalink which contains private information i.e. org name.
        request = env.request
        is_superuser = request and is_active_superuser(request) and request.user == user

        # If user is a sentry_app then it's a proxy user meaning we can't do a org lookup via `get_orgs()`
        # because the user isn't an org member. Instead we can use the auth token and the installation
        # it's associated with to find out what organization the token has access to.
        is_valid_sentryapp = False
        if (
            request
            and getattr(request.user, "is_sentry_app", False)
            and isinstance(request.auth, ApiToken)
        ):
            is_valid_sentryapp = SentryAppInstallationToken.has_organization_access(
                request.auth, obj.organization
            )

        if (
            is_superuser
            or is_valid_sentryapp
            or (user.is_authenticated() and user.get_orgs().filter(id=obj.organization.id).exists())
        ):
            with sentry_sdk.start_span(op="GroupSerializerBase.serialize.permalink.build"):
                return obj.get_absolute_url()
        else:
            return None

    def _get_subscription(self, attrs):
        subscription_details = None
        if attrs["subscription"] is not disabled:
            is_subscribed, subscription = attrs["subscription"]
            if subscription is not None and subscription.is_active:
                subscription_details = {
                    "reason": SUBSCRIPTION_REASON_MAP.get(subscription.reason, "unknown")
                }
        else:
            is_subscribed = False
            subscription_details = {"disabled": True}
        return is_subscribed, subscription_details

    def serialize(self, obj, attrs, user):
        status_details, status_label = self._get_status(attrs, obj)
        permalink = self._get_permalink(obj, user)
        is_subscribed, subscription_details = self._get_subscription(attrs)
        share_id = attrs["share_id"]
        group_dict = {
            "id": six.text_type(obj.id),
            "shareId": share_id,
            "shortId": obj.qualified_short_id,
            "title": obj.title,
            "culprit": obj.culprit,
            "permalink": permalink,
            "logger": obj.logger or None,
            "level": LOG_LEVELS.get(obj.level, "unknown"),
            "status": status_label,
            "statusDetails": status_details,
            "isPublic": share_id is not None,
            "platform": obj.platform,
            "project": {
                "id": six.text_type(obj.project.id),
                "name": obj.project.name,
                "slug": obj.project.slug,
                "platform": obj.project.platform,
            },
            "type": obj.get_event_type(),
            "metadata": obj.get_event_metadata(),
            "numComments": obj.num_comments,
            "assignedTo": serialize(attrs["assigned_to"], user, ActorSerializer()),
            "isBookmarked": attrs["is_bookmarked"],
            "isSubscribed": is_subscribed,
            "subscriptionDetails": subscription_details,
            "hasSeen": attrs["has_seen"],
            "annotations": attrs["annotations"],
        }

        # This attribute is currently feature gated
        if "is_unhandled" in attrs:
            group_dict["isUnhandled"] = attrs["is_unhandled"]

        group_dict.update(self._convert_seen_stats(attrs))
        return group_dict

    def _convert_seen_stats(self, stats):
        return {
            "count": six.text_type(stats["times_seen"]),
            "userCount": stats["user_count"],
            "firstSeen": stats["first_seen"],
            "lastSeen": stats["last_seen"],
        }


@register(Group)
class GroupSerializer(GroupSerializerBase):
    def __init__(self, environment_func=None):
        self.environment_func = environment_func if environment_func is not None else lambda: None

    def _get_seen_stats(self, item_list, user):
        try:
            environment = self.environment_func()
        except Environment.DoesNotExist:
            user_counts = {}
            first_seen = {}
            last_seen = {}
            times_seen = {}
        else:
            project_id = item_list[0].project_id
            item_ids = [g.id for g in item_list]
            user_counts = tagstore.get_groups_user_counts(
                [project_id], item_ids, environment_ids=environment and [environment.id]
            )
            first_seen = {}
            last_seen = {}
            times_seen = {}
            if environment is not None:
                environment_tagvalues = tagstore.get_group_list_tag_value(
                    [project_id], item_ids, [environment.id], "environment", environment.name
                )
                for item_id, value in environment_tagvalues.items():
                    first_seen[item_id] = value.first_seen
                    last_seen[item_id] = value.last_seen
                    times_seen[item_id] = value.times_seen
            else:
                for item in item_list:
                    first_seen[item.id] = item.first_seen
                    last_seen[item.id] = item.last_seen
                    times_seen[item.id] = item.times_seen

        attrs = {}
        for item in item_list:
            attrs[item] = {
                "times_seen": times_seen.get(item.id, 0),
                "first_seen": first_seen.get(item.id),  # TODO: missing?
                "last_seen": last_seen.get(item.id),
                "user_count": user_counts.get(item.id, 0),
            }

        return attrs


class GroupStatsMixin(object):
    STATS_PERIOD_CHOICES = {
        "14d": StatsPeriod(14, timedelta(hours=24)),
        "24h": StatsPeriod(24, timedelta(hours=1)),
    }

    CUSTOM_ROLLUP_CHOICES = {
        "1h": timedelta(hours=1).total_seconds(),
        "2h": timedelta(hours=2).total_seconds(),
        "3h": timedelta(hours=3).total_seconds(),
        "6h": timedelta(hours=6).total_seconds(),
        "12h": timedelta(hours=12).total_seconds(),
        "24h": timedelta(hours=24).total_seconds(),
    }

    CUSTOM_SEGMENTS = 29  # for 30 segments use 1/29th intervals
    CUSTOM_SEGMENTS_12H = 35  # for 12h 36 segments, otherwise 15-16-17 bars is too few
    CUSTOM_ROLLUP_6H = timedelta(hours=6).total_seconds()  # rollups should be increments of 6hs

    def query_tsdb(self, group_ids, query_params):
        raise NotImplementedError

    def get_stats(self, item_list, user, **kwargs):
        if self.stats_period:
            # we need to compute stats at 1d (1h resolution), and 14d or a custom given period
            group_ids = [g.id for g in item_list]

            if self.stats_period == "auto":
                total_period = (self.stats_period_end - self.stats_period_start).total_seconds()
                if total_period < timedelta(hours=24).total_seconds():
                    rollup = total_period / self.CUSTOM_SEGMENTS
                elif total_period < self.CUSTOM_SEGMENTS * self.CUSTOM_ROLLUP_CHOICES["1h"]:
                    rollup = self.CUSTOM_ROLLUP_CHOICES["1h"]
                elif total_period < self.CUSTOM_SEGMENTS * self.CUSTOM_ROLLUP_CHOICES["2h"]:
                    rollup = self.CUSTOM_ROLLUP_CHOICES["2h"]
                elif total_period < self.CUSTOM_SEGMENTS * self.CUSTOM_ROLLUP_CHOICES["3h"]:
                    rollup = self.CUSTOM_ROLLUP_CHOICES["3h"]
                elif total_period < self.CUSTOM_SEGMENTS * self.CUSTOM_ROLLUP_CHOICES["6h"]:
                    rollup = self.CUSTOM_ROLLUP_CHOICES["6h"]
                elif (
                    total_period < self.CUSTOM_SEGMENTS_12H * self.CUSTOM_ROLLUP_CHOICES["12h"]
                ):  # 36 segments is ok
                    rollup = self.CUSTOM_ROLLUP_CHOICES["12h"]
                elif total_period < self.CUSTOM_SEGMENTS * self.CUSTOM_ROLLUP_CHOICES["24h"]:
                    rollup = self.CUSTOM_ROLLUP_CHOICES["24h"]
                else:
                    delta_day = self.CUSTOM_ROLLUP_CHOICES["24h"]
                    rollup = round(total_period / (self.CUSTOM_SEGMENTS * delta_day)) * delta_day

                query_params = {
                    "start": self.stats_period_start,
                    "end": self.stats_period_end,
                    "rollup": int(rollup),
                }
            else:
                segments, interval = self.STATS_PERIOD_CHOICES[self.stats_period]
                now = timezone.now()
                query_params = {
                    "start": now - ((segments - 1) * interval),
                    "end": now,
                    "rollup": int(interval.total_seconds()),
                }

            return self.query_tsdb(group_ids, query_params, **kwargs)


class StreamGroupSerializer(GroupSerializer, GroupStatsMixin):
    def __init__(
        self,
        environment_func=None,
        stats_period=None,
        stats_period_start=None,
        stats_period_end=None,
        matching_event_id=None,
        matching_event_environment=None,
    ):
        super(StreamGroupSerializer, self).__init__(environment_func)

        if stats_period is not None:
            assert stats_period in self.STATS_PERIOD_CHOICES or stats_period == "auto"

        self.stats_period = stats_period
        self.stats_period_start = stats_period_start
        self.stats_period_end = stats_period_end
        self.matching_event_id = matching_event_id
        self.matching_event_environment = matching_event_environment

    def query_tsdb(self, group_ids, query_params, **kwargs):
        try:
            environment = self.environment_func()
        except Environment.DoesNotExist:
            stats = {key: tsdb.make_series(0, **query_params) for key in group_ids}
        else:
            stats = tsdb.get_range(
                model=tsdb.models.group,
                keys=group_ids,
                environment_ids=environment and [environment.id],
                **query_params
            )

        return stats

    def get_attrs(self, item_list, user):
        attrs = super(StreamGroupSerializer, self).get_attrs(item_list, user)

        if self.stats_period:
            stats = self.get_stats(item_list, user)
            for item in item_list:
                attrs[item].update({"stats": stats[item.id]})

        return attrs

    def serialize(self, obj, attrs, user):
        result = super(StreamGroupSerializer, self).serialize(obj, attrs, user)

        if self.stats_period:
            result["stats"] = {self.stats_period: attrs["stats"]}

        if self.matching_event_id:
            result["matchingEventId"] = self.matching_event_id

        if self.matching_event_environment:
            result["matchingEventEnvironment"] = self.matching_event_environment

        return result


class TagBasedStreamGroupSerializer(StreamGroupSerializer):
    def __init__(self, tags, **kwargs):
        super(TagBasedStreamGroupSerializer, self).__init__(**kwargs)
        self.tags = tags

    def serialize(self, obj, attrs, user):
        result = super(TagBasedStreamGroupSerializer, self).serialize(obj, attrs, user)
        result["tagLastSeen"] = self.tags[obj.id].last_seen
        result["tagFirstSeen"] = self.tags[obj.id].first_seen
        return result


class SharedGroupSerializer(GroupSerializer):
    def serialize(self, obj, attrs, user):
        result = super(SharedGroupSerializer, self).serialize(obj, attrs, user)
        del result["annotations"]
        return result


class GroupSerializerSnuba(GroupSerializerBase):
    skip_snuba_fields = {
        "query",
        "status",
        "bookmarked_by",
        "assigned_to",
        "unassigned",
        "subscribed_by",
        "active_at",
        "first_release",
        "first_seen",
    }

    def __init__(self, environment_ids=None, start=None, end=None, search_filters=None):
        self.environment_ids = environment_ids
        self.start = start
        self.end = end
        self.conditions = (
            [
                convert_search_filter_to_snuba_query(search_filter)
                for search_filter in search_filters
                if search_filter.key.name not in self.skip_snuba_fields
            ]
            if search_filters is not None
            else []
        )

    def _execute_seen_stats_query(
        self, item_list, start=None, end=None, conditions=None, environment_ids=None
    ):
        project_ids = list(set([item.project_id for item in item_list]))
        group_ids = [item.id for item in item_list]
        aggregations = [
            ["count()", "", "times_seen"],
            ["min", "timestamp", "first_seen"],
            ["max", "timestamp", "last_seen"],
            ["uniq", "tags[sentry:user]", "count"],
        ]
        filters = {"project_id": project_ids, "group_id": group_ids}
        if self.environment_ids:
            filters["environment"] = self.environment_ids
        result = snuba.aliased_query(
            dataset=snuba.Dataset.Events,
            start=start,
            end=end,
            groupby=["group_id"],
            conditions=conditions,
            filter_keys=filters,
            aggregations=aggregations,
            referrer="serializers.GroupSerializerSnuba._execute_seen_stats_query",
        )
        seen_data = {
            issue["group_id"]: fix_tag_value_data(
                dict(filter(lambda key: key[0] != "group_id", six.iteritems(issue)))
            )
            for issue in result["data"]
        }
        user_counts = {item_id: value["count"] for item_id, value in seen_data.items()}
        last_seen = {item_id: value["last_seen"] for item_id, value in seen_data.items()}
        if not environment_ids and not start and not end and not conditions:
            first_seen = {item.id: item.first_seen for item in item_list}
            times_seen = {item.id: item.times_seen for item in item_list}
        else:
            first_seen = {
                ge["group_id"]: ge["first_seen__min"]
                for ge in GroupEnvironment.objects.filter(
                    group_id__in=[item.id for item in item_list],
                    environment_id__in=environment_ids,
                )
                .values("group_id")
                .annotate(Min("first_seen"))
            }
            times_seen = {item_id: value["times_seen"] for item_id, value in seen_data.items()}

        attrs = {}
        for item in item_list:
            attrs[item] = {
                "times_seen": times_seen.get(item.id, 0),
                "first_seen": first_seen.get(item.id),
                "last_seen": last_seen.get(item.id),
                "user_count": user_counts.get(item.id, 0),
            }
        return attrs

    def _get_seen_stats(self, item_list, user):
        return self._execute_seen_stats_query(
            item_list=item_list,
            start=self.start,
            end=self.end,
            conditions=self.conditions,
            environment_ids=self.environment_ids,
        )


class StreamGroupSerializerSnuba(GroupSerializerSnuba, GroupStatsMixin):
    def __init__(
        self,
        environment_ids=None,
        stats_period=None,
        stats_period_start=None,
        stats_period_end=None,
        matching_event_id=None,
        start=None,
        end=None,
        search_filters=None,
        has_dynamic_issue_counts=False,
    ):
        super(StreamGroupSerializerSnuba, self).__init__(
            environment_ids, start, end, search_filters
        )

        if stats_period is not None:
            assert stats_period in self.STATS_PERIOD_CHOICES or (
                stats_period == "auto" and stats_period_start and stats_period_end
            )

        self.stats_period = stats_period
        self.stats_period_start = stats_period_start
        self.stats_period_end = stats_period_end
        self.matching_event_id = matching_event_id
        self.has_dynamic_issue_counts = has_dynamic_issue_counts

    def _get_seen_stats(self, item_list, user):
        partial_execute_seen_stats_query = functools.partial(
            self._execute_seen_stats_query,
            item_list=item_list,
            environment_ids=self.environment_ids,
            start=self.start,
            end=self.end,
        )
        time_range_result = partial_execute_seen_stats_query()
        if self.has_dynamic_issue_counts:
            filtered_result = (
                partial_execute_seen_stats_query(conditions=self.conditions)
                if self.conditions
                else None
            )
            lifetime_result = (
                partial_execute_seen_stats_query(start=None, end=None)
                if self.start or self.end
                else time_range_result
            )
            for item in item_list:
                time_range_result[item].update(
                    {
                        "filtered": filtered_result.get(item) if self.conditions else None,
                        "lifetime": lifetime_result.get(item),
                    }
                )
        return time_range_result

    def query_tsdb(self, group_ids, query_params, conditions=None, environment_ids=None, **kwargs):
        return snuba_tsdb.get_range(
            model=snuba_tsdb.models.group,
            keys=group_ids,
            environment_ids=environment_ids,
            conditions=conditions,
            **query_params
        )

    def get_attrs(self, item_list, user):
        attrs = super(StreamGroupSerializerSnuba, self).get_attrs(item_list, user)
        if self.stats_period:
            partial_get_stats = functools.partial(
                self.get_stats, item_list=item_list, user=user, environment_ids=self.environment_ids
            )
            stats = partial_get_stats()
            if self.has_dynamic_issue_counts:
                filtered_stats = (
                    partial_get_stats(conditions=self.conditions) if self.conditions else None
                )
            for item in item_list:
                if self.has_dynamic_issue_counts and self.conditions:
                    attrs[item].update({"filtered_stats": filtered_stats[item.id]})
                attrs[item].update({"stats": stats[item.id]})

        return attrs

    def serialize(self, obj, attrs, user):
        result = super(StreamGroupSerializerSnuba, self).serialize(obj, attrs, user)

        if self.stats_period:
            result["stats"] = {self.stats_period: attrs["stats"]}

        if self.matching_event_id:
            result["matchingEventId"] = self.matching_event_id

        if self.has_dynamic_issue_counts:
            result["lifetime"] = self._convert_seen_stats(attrs["lifetime"])
            if self.stats_period:
                result["lifetime"].update({"stats": None})  # Not needed in current implementation

            if self.conditions:
                result["filtered"] = self._convert_seen_stats(attrs["filtered"])
                if self.stats_period:
                    result["filtered"].update(
                        {"stats": {self.stats_period: attrs["filtered_stats"]}}
                    )
            else:
                result["filtered"] = None

        return result
