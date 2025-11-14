from __future__ import annotations
from typing import int

from django.http import Http404
from django.http.response import HttpResponseBase
from rest_framework.request import Request

from sentry.api.helpers.environments import get_environment_id
from sentry.data_export.base import ExportError
from sentry.data_export.processors.issues_by_tag import (
    GroupTagValueAndEventUser,
    IssuesByTagProcessor,
)
from sentry.models.environment import Environment
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.web.frontend.base import ProjectView, region_silo_view
from sentry.web.frontend.csv import CsvResponder


class GroupTagCsvResponder(CsvResponder[GroupTagValueAndEventUser]):
    def __init__(self, key: str) -> None:
        self.key = key

    def get_header(self) -> tuple[str, ...]:
        return tuple(IssuesByTagProcessor.get_header_fields(self.key))

    def get_row(self, item: GroupTagValueAndEventUser) -> tuple[str, ...]:
        fields = IssuesByTagProcessor.get_header_fields(self.key)
        item_dict = IssuesByTagProcessor.serialize_row(item, self.key)
        return tuple(item_dict[field] for field in fields)


@region_silo_view
class GroupTagExportView(ProjectView):
    required_scope = "event:read"

    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=10, window=1, concurrent_limit=10),
                RateLimitCategory.USER: RateLimit(limit=10, window=1, concurrent_limit=10),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=20, window=1, concurrent_limit=5),
            }
        }
    )

    def get(self, request: Request, organization, project, group_id, key) -> HttpResponseBase:
        # If the environment doesn't exist then the tag can't possibly exist
        try:
            environment_id = get_environment_id(request, project.organization_id)
        except Environment.DoesNotExist:
            raise Http404

        try:
            processor = IssuesByTagProcessor(
                project_id=project.id,
                group_id=group_id,
                key=key,
                environment_id=environment_id,
                tenant_ids={"organization_id": project.organization_id},
            )
        except ExportError:
            raise Http404

        filename = f"{processor.group.qualified_short_id or processor.group.id}-{key}"

        return GroupTagCsvResponder(key).respond(processor.get_raw_data(), filename)
