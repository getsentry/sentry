import itertools
from functools import partial, reduce
from operator import or_

from django.db.models import Q

from sentry.models import EventUser, Project, ProjectStatus, Release
from sentry.utils.dates import to_timestamp
from sentry.utils.geo import geo_by_addr

HEALTH_ID_KEY = "_health_id"


def make_health_id(lookup, value):
    # Convert a lookup and value into
    # a string that can be used back in a request query.
    return f"{lookup.name}:{lookup.encoder(value)}"


def serialize_releases(organization, item_list, user, lookup):
    return {
        (r.version,): {
            HEALTH_ID_KEY: make_health_id(lookup, [r.version]),
            "value": {"id": r.id, "version": r.version},
        }
        for r in Release.objects.filter(
            organization=organization, version__in={i[0] for i in item_list}
        )
    }


def serialize_eventusers(organization, item_list, user, lookup):
    if not item_list:
        return {}

    # We have no reliable way to map the tag value format
    # back into real EventUser rows. EventUser is only unique
    # per-project, and this is an organization aggregate.
    # This means a single value maps to multiple rows.
    filters = reduce(
        or_,
        [Q(hash=EventUser.hash_from_tag(tag), project_id=project) for tag, project in item_list],
    )

    eu_by_key = {(eu.tag_value, eu.project_id): eu for eu in EventUser.objects.filter(filters)}

    projects = serialize_projects(organization, {i[1] for i in item_list}, user)

    rv = {}
    for tag, project in item_list:
        eu = eu_by_key.get((tag, project))
        if eu is None:
            attr, value = tag.split(":", 1)
            eu = EventUser(project_id=project, **{EventUser.attr_from_keyword(attr): value})
        rv[(tag, project)] = {
            HEALTH_ID_KEY: make_health_id(lookup, [eu.tag_value, eu.project_id]),
            "value": {
                "id": str(eu.id) if eu.id else None,
                "project": projects.get(eu.project_id),
                "hash": eu.hash,
                "tagValue": eu.tag_value,
                "identifier": eu.ident,
                "username": eu.username,
                "email": eu.email,
                "ipAddress": eu.ip_address,
                "dateCreated": eu.date_added,
                "label": eu.get_label(),
                "name": eu.get_display_name(),
                "geo": geo_by_addr(eu.ip_address),
            },
        }
    return rv


def encoder_eventuser(value):
    # EventUser needs to be encoded as a
    # project_id, value tuple.
    tag_value, project_id = value
    return "%d:%s" % (project_id, tag_value)


def serialize_projects(organization, item_list, user):
    return {
        id: {"id": id, "slug": slug}
        for id, slug in Project.objects.filter(
            id__in=item_list, organization=organization, status=ProjectStatus.VISIBLE
        ).values_list("id", "slug")
    }


def serialize_noop(organization, item_list, user, lookup):
    return {i: {HEALTH_ID_KEY: make_health_id(lookup, [i[0]]), "value": i[0]} for i in item_list}


def encoder_noop(row):
    if not row:
        return None
    return row[0]


def value_from_row(row, tagkey):
    return tuple(row[k] for k in tagkey)


def zerofill(data, start, end, rollup, allow_partial_buckets=False):
    rv = []
    end = int(to_timestamp(end))
    rollup_start = (int(to_timestamp(start)) // rollup) * rollup
    rollup_end = (end // rollup) * rollup

    # Fudge the end value when we're only getting a single window.
    # This ensure that we get both values for a single large window that
    # straddles two buckets. An example of this is a 1d window that starts
    # mid day.
    if rollup_end - rollup_start == rollup:
        rollup_end += 1
    i = 0
    for key in range(rollup_start, rollup_end, rollup):
        try:
            while data[i][0] < key:
                rv.append(data[i])
                i += 1
            if data[i][0] == key:
                rv.append(data[i])
                i += 1
                continue
        except IndexError:
            pass

        rv.append((key, []))
    # Add any remaining rows that are not aligned to the rollup and are lower than the
    # end date.
    if i < len(data):
        end_timestamp = end if allow_partial_buckets else rollup_end
        rv.extend(row for row in data[i:] if row[0] < end_timestamp)

    return rv


def calculateTimeframe(start, end, rollup):
    rollup_start = (int(to_timestamp(start)) // rollup) * rollup
    rollup_end = (int(to_timestamp(end)) // rollup) * rollup
    if rollup_end - rollup_start == rollup:
        rollup_end += 1
    return {"start": rollup_start, "end": rollup_end}


class SnubaLookup:
    """
    A SnubaLookup consists of all of the attributes needed to facilitate making
    a query for a column in Snuba. This covers which columns are selected, the extra conditions
    that need to be applied, how values are serialized in/out of Snuba, etc.
    """

    __slots__ = (
        "name",
        "tagkey",
        "columns",
        "selected_columns",
        "conditions",
        "serializer",
        "encoder",
        "filter_key",
    )
    __registry = {}

    def __init__(
        self,
        name,
        tagkey=None,
        extra=None,
        selected_columns=None,
        conditions=None,
        serializer=serialize_noop,
        encoder=encoder_noop,
        filter_key=None,
    ):
        cls = type(self)
        assert name not in cls.__registry
        self.name = name
        self.tagkey = tagkey or name
        self.columns = [self.tagkey] + list(extra or [])
        self.serializer = partial(serializer, lookup=self)
        self.encoder = encoder
        self.conditions = conditions or [[self.tagkey, "IS NOT NULL", None]]
        self.selected_columns = selected_columns or []
        self.filter_key = filter_key or self.tagkey
        cls.__registry[name] = self

    @classmethod
    def get(cls, name):
        return cls.__registry[name]


SnubaLookup(
    "user",
    "tags[sentry:user]",
    ["project_id"],
    serializer=serialize_eventusers,
    encoder=encoder_eventuser,
    # User is a complex query and can't be treated as a single value.
    # And EventUser is a tuple of project_id and the tag value. So we need
    # to make sure we always keep them together and query them as a single unit.
    filter_key=("concat", (("toString", ("project_id",)), "':'", "tags[sentry:user]")),
)
SnubaLookup("release", "tags[sentry:release]", serializer=serialize_releases)
# error.type is special in that in ClickHouse, it's an array. But we need
# to make sure that we don't do any queries across a NULL value or an empty array
# so we must filter them out explicitly. We also are choosing to explicitly take the
# first element of the exception_stacks array as the "primary" error type for the event.
# This is slightly inaccurate due to the fact that a single error may have multiple
# errors.
SnubaLookup(
    "error.type",
    "error_type",
    selected_columns=[
        ("ifNull", ("arrayElement", ("exception_stacks.type", 1), "''"), "error_type")
    ],
    conditions=[[("notEmpty", ("exception_stacks.type",)), "=", 1], [("error_type", "!=", "")]],
)
# Similar to error.type, we need to also guard against NULL types, but for this case,
# the NULL type is actually significant for us, which means "unknown". So we want
# to also retain and capture this.
SnubaLookup(
    "error.handled",
    "error_handled",
    selected_columns=[("arrayElement", ("exception_stacks.mechanism_handled", 1), "error_handled")],
    conditions=[[("notEmpty", ("exception_stacks.mechanism_handled",)), "=", 1]],
)

# Simple tags don't need any special treatment
for _tag in ("transaction", "os", "os.name", "browser", "browser.name", "device", "device.family"):
    SnubaLookup(_tag, "tags[%s]" % _tag)


class BaseSnubaSerializer:
    def __init__(self, organization, lookup, user):
        self.organization = organization
        self.lookup = lookup
        self.user = user

    def get_attrs(self, item_list):
        if self.lookup is None:
            return item_list

        return self.lookup.serializer(self.organization, item_list, self.user)


class SnubaResultSerializer(BaseSnubaSerializer):
    """
    Serializer for the top values Snuba results.
    """

    def serialize(self, result):
        counts_by_value = {
            value_from_row(r, self.lookup.columns): r["count"] for r in result.previous["data"]
        }
        projects = serialize_projects(
            self.organization,
            {p for r in result.current["data"] for p in r.get("top_projects", [])},
            self.user,
        )
        attrs = self.get_attrs(
            [value_from_row(r, self.lookup.columns) for r in result.current["data"]]
        )

        data = []
        for r in result.current["data"]:
            value = value_from_row(r, self.lookup.columns)
            row = {
                "count": r["count"],
                "lastCount": counts_by_value.get(value, 0),
                self.lookup.name: attrs.get(value),
            }
            if "top_projects" in r:
                row["topProjects"] = [projects[p] for p in r["top_projects"]]
            if "total_projects" in r:
                row["totalProjects"] = r["total_projects"]

            data.append(row)

        return {
            "data": data,
            "totals": {
                "count": result.current["totals"]["count"],
                "lastCount": result.previous["totals"]["count"],
            },
        }


class SnubaTSResultSerializer(BaseSnubaSerializer):
    """
    Serializer for time-series Snuba data.
    """

    def serialize(
        self,
        result,
        column="count",
        order=None,
        allow_partial_buckets=False,
        zerofill_results=True,
        extra_columns=None,
    ):
        data = [
            (key, list(group))
            for key, group in itertools.groupby(result.data["data"], key=lambda r: r["time"])
        ]
        if self.lookup:
            attrs = self.get_attrs(
                [value_from_row(r, self.lookup.columns) for _, v in data for r in v]
            )
        rv = []
        for k, v in data:
            row = []
            for r in v:
                item = {"count": r.get(column, 0)}
                if extra_columns is not None:
                    for extra_column in extra_columns:
                        item[extra_column] = r.get(extra_column, 0)
                if self.lookup:
                    value = value_from_row(r, self.lookup.columns)
                    item[self.lookup.name] = (attrs.get(value),)
                row.append(item)
            rv.append((k, row))

        res = {
            "data": zerofill(
                rv,
                result.start,
                result.end,
                result.rollup,
                allow_partial_buckets=allow_partial_buckets,
            )
            if zerofill_results
            else rv
        }

        if result.data.get("totals"):
            res["totals"] = {"count": result.data["totals"][column]}
        # If order is passed let that overwrite whats in data since its order for multi-axis
        if order is not None:
            res["order"] = order
        elif "order" in result.data:
            res["order"] = result.data["order"]

        if hasattr(result, "start") and hasattr(result, "end"):
            timeframe = calculateTimeframe(result.start, result.end, result.rollup)
            res["start"] = timeframe["start"]
            res["end"] = timeframe["end"]

        return res
