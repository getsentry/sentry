from __future__ import absolute_import

import unittest

from datetime import datetime, timedelta
from django.utils import timezone

import pytest
import pytz

from sentry.models import GroupRelease, Release, Project
from sentry.testutils import TestCase
from sentry.utils.compat import mock
from sentry.utils.snuba import (
    _prepare_query_params,
    get_query_params_to_update_for_projects,
    get_snuba_translators,
    get_json_type,
    get_snuba_column_name,
    Dataset,
    SnubaQueryParams,
    UnqualifiedQueryError,
    quantize_time,
)


class SnubaUtilsTest(TestCase):
    def setUp(self):
        self.now = datetime.utcnow().replace(
            hour=0, minute=0, second=0, microsecond=0, tzinfo=pytz.UTC
        )
        self.proj1 = self.create_project()
        self.proj1env1 = self.create_environment(project=self.proj1, name="prod")
        self.proj1group1 = self.create_group(self.proj1)
        self.proj1group2 = self.create_group(self.proj1)

        self.release1 = Release.objects.create(
            organization_id=self.organization.id, version="1" * 10, date_added=self.now
        )
        self.release1.add_project(self.proj1)
        self.release2 = Release.objects.create(
            organization_id=self.organization.id, version="2" * 10, date_added=self.now
        )
        self.release2.add_project(self.proj1)

        self.group1release1 = GroupRelease.objects.create(
            project_id=self.proj1.id, group_id=self.proj1group1.id, release_id=self.release1.id
        )
        self.group1release2 = GroupRelease.objects.create(
            project_id=self.proj1.id, group_id=self.proj1group1.id, release_id=self.release2.id
        )
        self.group2release1 = GroupRelease.objects.create(
            project_id=self.proj1.id, group_id=self.proj1group2.id, release_id=self.release1.id
        )

    def test_translation(self):
        # Case 1: No translation
        filter_keys = {"sdk": ["python", "js"]}
        forward, reverse = get_snuba_translators(filter_keys)
        assert forward(filter_keys) == filter_keys
        result = [{"sdk": "python", "count": 123}, {"sdk": "js", "count": 234}]
        assert all(reverse(row) == row for row in result)

        # Case 2: Environment ID -> Name and back
        filter_keys = {"environment": [self.proj1env1.id]}
        forward, reverse = get_snuba_translators(filter_keys)
        assert forward(filter_keys) == {"environment": [self.proj1env1.name]}
        row = {"environment": self.proj1env1.name, "count": 123}
        assert reverse(row) == {"environment": self.proj1env1.id, "count": 123}

        # Case 3, both Environment and Release
        filter_keys = {
            "environment": [self.proj1env1.id],
            "tags[sentry:release]": [self.release1.id],
        }
        forward, reverse = get_snuba_translators(filter_keys)
        assert forward(filter_keys) == {
            "environment": [self.proj1env1.name],
            "tags[sentry:release]": [self.release1.version],
        }
        row = {
            "environment": self.proj1env1.name,
            "tags[sentry:release]": self.release1.version,
            "count": 123,
        }
        assert reverse(row) == {
            "environment": self.proj1env1.id,
            "tags[sentry:release]": self.release1.id,
            "count": 123,
        }

        # Case 4: 2 Groups, many-to-many mapping of Groups
        # to Releases. Reverse translation depends on multiple
        # fields.
        filter_keys = {
            "group_id": [self.proj1group1.id, self.proj1group2.id],
            "tags[sentry:release]": [
                self.group1release1.id,
                self.group1release2.id,
                self.group2release1.id,
            ],
        }
        forward, reverse = get_snuba_translators(filter_keys, is_grouprelease=True)
        assert forward(filter_keys) == {
            "group_id": [self.proj1group1.id, self.proj1group2.id],
            "tags[sentry:release]": [
                self.release1.version,
                self.release2.version,
                self.release1.version,  # Duplicated because 2 GroupReleases refer to it
            ],
        }
        result = [
            {
                "group_id": self.proj1group1.id,
                "tags[sentry:release]": self.release1.version,
                "count": 1,
            },
            {
                "group_id": self.proj1group1.id,
                "tags[sentry:release]": self.release2.version,
                "count": 2,
            },
            {
                "group_id": self.proj1group2.id,
                "tags[sentry:release]": self.release1.version,
                "count": 3,
            },
        ]

        result = [reverse(r) for r in result]
        assert result == [
            {
                "group_id": self.proj1group1.id,
                "tags[sentry:release]": self.group1release1.id,
                "count": 1,
            },
            {
                "group_id": self.proj1group1.id,
                "tags[sentry:release]": self.group1release2.id,
                "count": 2,
            },
            {
                "group_id": self.proj1group2.id,
                "tags[sentry:release]": self.group2release1.id,
                "count": 3,
            },
        ]

    def test_get_json_type(self):
        assert get_json_type("UInt8") == "boolean"
        assert get_json_type("UInt16") == "integer"
        assert get_json_type("UInt32") == "integer"
        assert get_json_type("UInt64") == "integer"
        assert get_json_type("Float32") == "number"
        assert get_json_type("Float64") == "number"
        assert get_json_type("Nullable(Float64)") == "number"
        assert get_json_type("Array(String)") == "array"
        assert get_json_type("Char") == "string"
        assert get_json_type("unknown") == "string"
        assert get_json_type("") == "string"

    def test_get_snuba_column_name(self):
        assert get_snuba_column_name("project_id") == "project_id"
        assert get_snuba_column_name("start") == "start"
        assert get_snuba_column_name("'thing'") == "'thing'"
        assert get_snuba_column_name("id") == "event_id"
        assert get_snuba_column_name("geo.region") == "geo_region"
        assert get_snuba_column_name("tags[sentry:user]") == "tags[sentry:user]"
        assert get_snuba_column_name("organization") == "tags[organization]"
        assert get_snuba_column_name("unknown-key") == "tags[unknown-key]"

        # measurements are not available on the Events dataset, so it's seen as a tag
        assert get_snuba_column_name("measurements_key", Dataset.Events) == "tags[measurements_key]"
        assert get_snuba_column_name("measurements.key", Dataset.Events) == "tags[measurements.key]"

        # measurements are available on the Discover and Transactions dataset, so its parsed as such
        assert get_snuba_column_name("measurements_key", Dataset.Discover) == "measurements.key"
        assert get_snuba_column_name("measurements_key", Dataset.Transactions) == "measurements.key"
        assert get_snuba_column_name("measurements.key", Dataset.Discover) == "measurements[key]"
        assert (
            get_snuba_column_name("measurements.key", Dataset.Transactions) == "measurements[key]"
        )
        assert get_snuba_column_name("measurements.KEY", Dataset.Discover) == "measurements[key]"
        assert (
            get_snuba_column_name("measurements.KEY", Dataset.Transactions) == "measurements[key]"
        )


class PrepareQueryParamsTest(TestCase):
    def test_events_dataset_with_project_id(self):
        query_params = SnubaQueryParams(
            dataset=Dataset.Events, filter_keys={"project_id": [self.project.id]}
        )

        kwargs, _, _ = _prepare_query_params(query_params)
        assert kwargs["project"] == [self.project.id]

    def test_with_deleted_project(self):
        query_params = SnubaQueryParams(
            dataset=Dataset.Events, filter_keys={"project_id": [self.project.id]}
        )

        self.project.delete()
        with pytest.raises(UnqualifiedQueryError):
            get_query_params_to_update_for_projects(query_params)

    @mock.patch("sentry.models.Project.objects.get_from_cache", side_effect=Project.DoesNotExist)
    def test_with_some_deleted_projects(self, mock_project):
        other_project = self.create_project(organization=self.organization, slug="a" * 32)
        query_params = SnubaQueryParams(
            dataset=Dataset.Events, filter_keys={"project_id": [self.project.id, other_project.id]}
        )

        other_project.delete()
        organization_id, _ = get_query_params_to_update_for_projects(query_params)
        assert organization_id == self.organization.id

    def test_outcomes_dataset_with_org_id(self):
        query_params = SnubaQueryParams(
            dataset=Dataset.Outcomes, filter_keys={"org_id": [self.organization.id]}
        )

        kwargs, _, _ = _prepare_query_params(query_params)
        assert kwargs["organization"] == self.organization.id

    def test_outcomes_dataset_with_key_id(self):
        key = self.create_project_key(project=self.project)
        query_params = SnubaQueryParams(dataset=Dataset.Outcomes, filter_keys={"key_id": [key.id]})

        kwargs, _, _ = _prepare_query_params(query_params)
        assert kwargs["organization"] == self.organization.id

    def test_outcomes_dataset_with_no_org_id_given(self):
        query_params = SnubaQueryParams(dataset=Dataset.Outcomes)

        with pytest.raises(UnqualifiedQueryError):
            _prepare_query_params(query_params)

    def test_invalid_dataset_provided(self):
        query_params = SnubaQueryParams(dataset="invalid_dataset")

        with pytest.raises(UnqualifiedQueryError):
            _prepare_query_params(query_params)


class QuantizeTimeTest(unittest.TestCase):
    def setUp(self):
        self.now = timezone.now().replace(microsecond=0)

    def test_cache_suffix_time(self):
        starting_key = quantize_time(self.now, 0)
        finishing_key = quantize_time(self.now + timedelta(seconds=300), 0)

        assert starting_key != finishing_key

    def test_quantize_hour_edges(self):
        """ a suffix should still behave correctly around the end of the hour

            At a duration of 10 only one key between 0-10 should flip on the hour, the other 9
            should flip at different times.
        """
        before = datetime(2019, 9, 5, 17, 59, 59)
        on_hour = datetime(2019, 9, 5, 18, 0, 0)
        changed_on_hour = 0
        # Check multiple keyhashes so that this test doesn't depend on implementation
        for key_hash in range(10):
            before_key = quantize_time(before, key_hash, duration=10)
            on_key = quantize_time(on_hour, key_hash, duration=10)
            if before_key != on_key:
                changed_on_hour += 1

        assert changed_on_hour == 1

    def test_quantize_day_edges(self):
        """ a suffix should still behave correctly around the end of a day

            This test is nearly identical to test_quantize_hour_edges, but is to confirm that date changes don't
            cause a different behaviour
        """
        before = datetime(2019, 9, 5, 23, 59, 59)
        next_day = datetime(2019, 9, 6, 0, 0, 0)
        changed_on_hour = 0
        for key_hash in range(10):
            before_key = quantize_time(before, key_hash, duration=10)
            next_key = quantize_time(next_day, key_hash, duration=10)
            if before_key != next_key:
                changed_on_hour += 1

        assert changed_on_hour == 1

    def test_quantize_time_matches_duration(self):
        """ The number of seconds between keys changing should match duration """
        previous_key = quantize_time(self.now, 0, duration=10)
        changes = []
        for i in range(21):
            current_time = self.now + timedelta(seconds=i)
            current_key = quantize_time(current_time, 0, duration=10)
            if current_key != previous_key:
                changes.append(current_time)
                previous_key = current_key

        assert len(changes) == 2
        assert (changes[1] - changes[0]).total_seconds() == 10

    def test_quantize_time_jitter(self):
        """ Different key hashes should change keys at different times

            While starting_key and other_key might begin as the same values they should change at different times
        """
        starting_key = quantize_time(self.now, 0, duration=10)
        for i in range(11):
            current_key = quantize_time(self.now + timedelta(seconds=i), 0, duration=10)
            if current_key != starting_key:
                break

        other_key = quantize_time(self.now, 5, duration=10)
        for j in range(11):
            current_key = quantize_time(self.now + timedelta(seconds=j), 5, duration=10)
            if current_key != other_key:
                break

        assert i != j
