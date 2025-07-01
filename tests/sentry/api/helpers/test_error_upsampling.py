from unittest.mock import Mock, patch

from django.http import QueryDict
from django.test import RequestFactory
from rest_framework.request import Request

from sentry.api.helpers.error_upsampling import (
    _are_all_projects_error_upsampled,
    _is_error_focused_query,
    _should_apply_sample_weight_transform,
    transform_query_columns_for_error_upsampling,
)
from sentry.models.organization import Organization
from sentry.search.events.types import SnubaParams
from sentry.snuba import discover, errors, transactions
from sentry.testutils.cases import TestCase


class ErrorUpsamplingTest(TestCase):
    def setUp(self) -> None:
        self.organization = Organization.objects.create(name="test-org")
        self.projects = [
            self.create_project(organization=self.organization, name="Project 1"),
            self.create_project(organization=self.organization, name="Project 2"),
            self.create_project(organization=self.organization, name="Project 3"),
        ]
        self.project_ids = [p.id for p in self.projects]
        self.snuba_params = SnubaParams(
            start=None,
            end=None,
            projects=self.projects,
        )
        factory = RequestFactory()
        self.request = Request(factory.get("/"))
        self.request.GET = QueryDict("")

    @patch("sentry.api.helpers.error_upsampling.options")
    def test_are_all_projects_error_upsampled(self, mock_options: Mock) -> None:
        # Test when all projects are allowlisted
        mock_options.get.return_value = self.project_ids
        assert _are_all_projects_error_upsampled(self.project_ids, self.organization) is True

        # Test when some projects are not allowlisted
        mock_options.get.return_value = self.project_ids[:-1]
        assert _are_all_projects_error_upsampled(self.project_ids, self.organization) is False

        # Test when no projects are allowlisted
        mock_options.get.return_value = []
        assert _are_all_projects_error_upsampled(self.project_ids, self.organization) is False

        # Test when no project IDs provided
        assert _are_all_projects_error_upsampled([], self.organization) is False

    def test_transform_query_columns_for_error_upsampling(self) -> None:
        # Test count() transformation
        columns = ["count()", "other_column"]
        expected = [
            "upsampled_count() as count",
            "other_column",
        ]
        assert transform_query_columns_for_error_upsampling(columns) == expected

        # Test case insensitivity
        columns = ["COUNT()"]
        expected = [
            "upsampled_count() as count",
        ]
        assert transform_query_columns_for_error_upsampling(columns) == expected

        # Test whitespace handling
        columns = [" count() "]
        expected = [
            "upsampled_count() as count",
        ]
        assert transform_query_columns_for_error_upsampling(columns) == expected

    def test_is_error_focused_query(self) -> None:
        # Test explicit error type
        self.request.GET = QueryDict("query=event.type:error")
        assert _is_error_focused_query(self.request) is True

        # Test explicit transaction type
        self.request.GET = QueryDict("query=event.type:transaction")
        assert _is_error_focused_query(self.request) is False

        # Test empty query
        self.request.GET = QueryDict("")
        assert _is_error_focused_query(self.request) is False

    def test_should_apply_sample_weight_transform(self) -> None:
        # Test errors dataset
        assert _should_apply_sample_weight_transform(errors, self.request) is True

        # Test transactions dataset
        assert _should_apply_sample_weight_transform(transactions, self.request) is False

        self.request.GET = QueryDict("query=event.type:error")
        assert _should_apply_sample_weight_transform(discover, self.request) is True

        self.request.GET = QueryDict("query=event.type:transaction")
        assert _should_apply_sample_weight_transform(discover, self.request) is False
