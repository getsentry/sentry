from typing import cast

import pytest

from sentry.snuba.metrics.naming_layer.mri import format_mri_field, format_mri_field_value
from sentry.testutils.cases import TestCase

pytestmark = pytest.mark.sentry_metrics


class TestMRIUtils(TestCase):
    def test_format_mri_field(self):
        assert format_mri_field("avg(c:custom/foo@none)") == "avg(foo)"
        assert format_mri_field("max(s:spans/user@none)") == "max(user)"
        assert format_mri_field("sum(d:spans/exclusive_time@millisecond)") == "sum(exclusive_time)"
        assert (
            format_mri_field("sum(c:custom/http.client.active_requests@{request})")
            == "sum(http.client.active_requests)"
        )
        assert format_mri_field("sum(c:custom/foo...bar@{request})") == "sum(foo...bar)"
        assert format_mri_field("invalid_mri_field") == "invalid_mri_field"
        assert format_mri_field(cast(str, None)) is None

    def test_format_mri_field_value(self):
        assert format_mri_field_value("avg(c:custom/foo@none)", "100.0") == "100.0"
        assert format_mri_field_value("count(s:spans/user@none)", "100") == "100"
        assert format_mri_field_value("sum(d:spans/exclusive_time@millisecond)", "1000") == "1 s"
        assert format_mri_field_value("invalid_mri_field", "100") == "100"
        assert format_mri_field_value(cast(str, None), "100") == "100"

    def test_span_metric_mri_field(self):
        config = {
            "spanAttribute": "browser.name",
            "aggregates": ["count_unique"],
            "unit": "none",
            "tags": [],
            "conditions": [
                {"value": "browser.name:Chrome or browser.name:Firefox"},
            ],
        }
        project = self.create_project(organization=self.organization, name="my new project")
        config_object = self.create_span_attribute_extraction_config(
            dictionary=config, user_id=self.user.id, project=project
        )
        condition_id = config_object.conditions.get().id
        assert (
            format_mri_field(f"count_unique(c:custom/span_attribute_{condition_id}@none)")
            == 'count_unique(browser.name) filtered by "browser.name:Chrome or browser.name:Firefox"'
        )

    def test_span_metric_mri_field_value(self):
        config = {
            "spanAttribute": "my_duration",
            "aggregates": ["avg", "min", "max", "sum"],
            "unit": "millisecond",
            "tags": [],
            "conditions": [
                {"value": "browser.name:Chrome or browser.name:Firefox"},
            ],
        }
        project = self.create_project(organization=self.organization, name="my new project")
        config_object = self.create_span_attribute_extraction_config(
            dictionary=config, user_id=self.user.id, project=project
        )
        condition_id = config_object.conditions.get().id
        assert (
            format_mri_field_value(f"avg(c:custom/span_attribute_{condition_id}@none)", "1000")
            == "1 s"
        )

    def test_span_metric_does_not_exist(self):
        config = {
            "spanAttribute": "my_duration",
            "aggregates": ["avg", "min", "max", "sum"],
            "unit": "millisecond",
            "tags": [],
            "conditions": [
                {"value": "browser.name:Chrome or browser.name:Firefox"},
            ],
        }
        project = self.create_project(organization=self.organization, name="my new project")
        self.create_span_attribute_extraction_config(
            dictionary=config, user_id=self.user.id, project=project
        )
        non_existent_id = 65537

        assert (
            format_mri_field_value(f"avg(c:custom/span_attribute_{non_existent_id}@none)", "1000")
            == "1000"
        )

        assert (
            format_mri_field(f"avg(c:custom/span_attribute_{non_existent_id}@none)")
            == f"avg(c:custom/span_attribute_{non_existent_id}@none)"
        )
