from __future__ import absolute_import

import six
import re
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from sentry.models import Project, ProjectStatus
from sentry.discover.models import KeyTransaction, MAX_KEY_TRANSACTIONS
from sentry.api.fields.empty_integer import EmptyIntegerField
from sentry.api.serializers.rest_framework import ListField
from sentry.api.utils import get_date_range_from_params, InvalidParams
from sentry.constants import ALL_ACCESS_PROJECTS
from sentry.utils.snuba import SENTRY_SNUBA_MAP


class DiscoverQuerySerializer(serializers.Serializer):
    projects = ListField(child=serializers.IntegerField(), required=True, allow_null=False)
    start = serializers.CharField(required=False, allow_null=True)
    end = serializers.CharField(required=False, allow_null=True)
    range = serializers.CharField(required=False, allow_null=True)
    statsPeriod = serializers.CharField(required=False, allow_null=True)
    statsPeriodStart = serializers.CharField(required=False, allow_null=True)
    statsPeriodEnd = serializers.CharField(required=False, allow_null=True)
    fields = ListField(child=serializers.CharField(), required=False, default=[])
    conditionFields = ListField(child=ListField(), required=False, allow_null=True)
    limit = EmptyIntegerField(min_value=0, max_value=10000, required=False, allow_null=True)
    rollup = EmptyIntegerField(required=False, allow_null=True)
    orderby = serializers.CharField(required=False, default="", allow_blank=True)
    conditions = ListField(child=ListField(), required=False, allow_null=True)
    aggregations = ListField(child=ListField(), required=False, default=[])
    groupby = ListField(child=serializers.CharField(), required=False, allow_null=True)
    turbo = serializers.BooleanField(required=False)

    def __init__(self, *args, **kwargs):
        super(DiscoverQuerySerializer, self).__init__(*args, **kwargs)

        data = kwargs["data"]

        fields = data.get("fields") or []

        match = next(
            (
                self.get_array_field(field).group(1)
                for field in fields
                if self.get_array_field(field) is not None
            ),
            None,
        )
        self.arrayjoin = match if match else None

    def validate(self, data):
        data["arrayjoin"] = self.arrayjoin

        # prevent conflicting date ranges from being supplied
        date_fields = ["start", "statsPeriod", "range", "statsPeriodStart"]
        date_fields_provided = len([data.get(f) for f in date_fields if data.get(f) is not None])
        if date_fields_provided == 0:
            raise serializers.ValidationError("You must specify a date filter")
        elif date_fields_provided > 1:
            raise serializers.ValidationError("Conflicting date filters supplied")

        if not data.get("fields") and not data.get("aggregations"):
            raise serializers.ValidationError("Specify at least one field or aggregation")

        try:
            start, end = get_date_range_from_params(
                {
                    "start": data.get("start"),
                    "end": data.get("end"),
                    "statsPeriod": data.get("statsPeriod") or data.get("range"),
                    "statsPeriodStart": data.get("statsPeriodStart"),
                    "statsPeriodEnd": data.get("statsPeriodEnd"),
                },
                optional=True,
            )
        except InvalidParams as e:
            raise serializers.ValidationError(six.text_type(e))

        if start is None or end is None:
            raise serializers.ValidationError("Either start and end dates or range is required")

        data["start"] = start
        data["end"] = end

        return data

    def validate_conditions(self, value):
        # Handle error (exception_stacks), stack(exception_frames)
        return [self.get_condition(condition) for condition in value]

    def validate_aggregations(self, value):
        valid_functions = set(["count()", "uniq", "avg", "sum"])
        requested_functions = set(agg[0] for agg in value)

        if not requested_functions.issubset(valid_functions):
            invalid_functions = ", ".join((requested_functions - valid_functions))

            raise serializers.ValidationError(
                u"Invalid aggregate function - {}".format(invalid_functions)
            )

        return value

    def get_array_field(self, field):
        pattern = r"^(error|stack)\..+"
        term = re.search(pattern, field)
        if term and SENTRY_SNUBA_MAP.get(field):
            return term
        return None

    def get_condition(self, condition):
        array_field = self.get_array_field(condition[0])
        has_equality_operator = condition[1] in ("=", "!=")

        # Cast boolean values to 1 / 0
        if isinstance(condition[2], bool):
            condition[2] = int(condition[2])

        # Strip double quotes on strings
        if isinstance(condition[2], six.string_types):
            match = re.search(r'^"(.*)"$', condition[2])
            if match:
                condition[2] = match.group(1)

        # Apply has function to any array field if it's = / != and not part of arrayjoin
        if array_field and has_equality_operator and (array_field.group(1) != self.arrayjoin):
            value = condition[2]

            if isinstance(value, six.string_types):
                value = u"'{}'".format(value)

            bool_value = 1 if condition[1] == "=" else 0

            return [["has", [array_field.group(0), value]], "=", bool_value]

        return condition


class DiscoverSavedQuerySerializer(serializers.Serializer):
    name = serializers.CharField(required=True)
    projects = ListField(child=serializers.IntegerField(), required=False, default=[])
    start = serializers.DateTimeField(required=False, allow_null=True)
    end = serializers.DateTimeField(required=False, allow_null=True)
    range = serializers.CharField(required=False, allow_null=True)
    fields = ListField(child=serializers.CharField(), required=False, allow_null=True)
    orderby = serializers.CharField(required=False, allow_null=True)

    # This block of fields is only accepted by discover 1 which omits the version
    # attribute or has it set to 1
    rollup = serializers.IntegerField(required=False, allow_null=True)
    aggregations = ListField(child=ListField(), required=False, allow_null=True)
    groupby = ListField(child=serializers.CharField(), required=False, allow_null=True)
    conditions = ListField(child=ListField(), required=False, allow_null=True)
    limit = serializers.IntegerField(min_value=0, max_value=1000, required=False, allow_null=True)

    # There are multiple versions of saved queries supported.
    version = serializers.IntegerField(min_value=1, max_value=2, required=False, allow_null=True)

    # Attributes that are only accepted if version = 2
    environment = ListField(child=serializers.CharField(), required=False, allow_null=True)
    query = serializers.CharField(required=False, allow_null=True)
    widths = ListField(child=serializers.CharField(), required=False, allow_null=True)
    yAxis = serializers.CharField(required=False, allow_null=True)

    disallowed_fields = {
        1: set(["environment", "query", "yAxis"]),
        2: set(["groupby", "rollup", "aggregations", "conditions", "limit"]),
    }

    def validate_projects(self, projects):
        organization = self.context["organization"]

        projects = set(projects)
        if projects == ALL_ACCESS_PROJECTS:
            return projects

        org_projects = set(
            Project.objects.filter(
                organization=organization, id__in=projects, status=ProjectStatus.VISIBLE
            ).values_list("id", flat=True)
        )
        if projects != org_projects:
            raise PermissionDenied

        return projects

    def validate(self, data):
        query = {}
        query_keys = [
            "environment",
            "query",
            "fields",
            "conditions",
            "aggregations",
            "range",
            "start",
            "end",
            "orderby",
            "limit",
            "widths",
            "yAxis",
        ]

        for key in query_keys:
            if data.get(key) is not None:
                query[key] = data[key]

        version = data.get("version", 1)
        self.validate_version_fields(version, query)
        if version == 2:
            if len(query["fields"]) < 1:
                raise serializers.ValidationError("You must include at least one field.")

        if data["projects"] == ALL_ACCESS_PROJECTS:
            data["projects"] = []
            query["all_projects"] = True

        return {
            "name": data["name"],
            "project_ids": data["projects"],
            "query": query,
            "version": version,
        }

    def validate_version_fields(self, version, query):
        try:
            not_allowed = self.disallowed_fields[version]
        except KeyError:
            raise serializers.ValidationError("Invalid version requested.")
        bad_fields = set(query.keys()) & not_allowed
        if bad_fields:
            raise serializers.ValidationError(
                "You cannot use the %s attribute(s) with the selected version"
                % ", ".join(bad_fields)
            )


class KeyTransactionSerializer(serializers.Serializer):
    transaction = serializers.CharField(required=True, max_length=200)

    def validate(self, data):
        data = super(KeyTransactionSerializer, self).validate(data)
        base_filter = self.context.copy()
        # Limit the number of key transactions
        if KeyTransaction.objects.filter(**base_filter).count() >= MAX_KEY_TRANSACTIONS:
            raise serializers.ValidationError(
                "At most {} Key Transactions can be added".format(MAX_KEY_TRANSACTIONS)
            )

        base_filter["transaction"] = data["transaction"]

        if KeyTransaction.objects.filter(**base_filter).count() > 0:
            raise serializers.ValidationError("This Key Transaction was already added")
        return data
