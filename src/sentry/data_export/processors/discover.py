from __future__ import absolute_import

import logging

from sentry.api.utils import get_date_range_from_params
from sentry.snuba import discover
from sentry.models import Group, Project

from ..base import ExportError

logger = logging.getLogger(__name__)


class DiscoverProcessor(object):
    """
    Processor for exports of discover data based on a provided query
    """

    def __init__(self, organization_id, discover_query):
        self.projects = self.get_projects(organization_id, discover_query)
        self.start, self.end = get_date_range_from_params(discover_query)
        self.params = {
            "organization_id": organization_id,
            "project_id": [project.id for project in self.projects],
            "start": self.start,
            "end": self.end,
        }
        self.header_fields = discover_query["field"]
        self.data_fn = self.get_data_fn(
            fields=discover_query["field"], query=discover_query["query"], params=self.params
        )

    @staticmethod
    def get_projects(organization_id, query):
        project_ids = query.get("project")
        try:
            if isinstance(project_ids, list):
                return Project.objects.filter(id__in=project_ids)
            else:
                return [Project.objects.get_from_cache(id=project_ids)]
        except Project.DoesNotExist:
            raise ExportError("Requested project does not exist")

    @staticmethod
    def get_data_fn(fields, query, params):
        def data_fn(offset, limit):
            return discover.query(
                selected_columns=fields,
                query=query,
                params=params,
                offset=offset,
                limit=limit,
                referrer="data_export.tasks.discover",
                auto_fields=True,
                use_aggregate_conditions=True,
            )

        return data_fn

    def handle_fields(self, result_list):
        # Find issue short_id if present
        # (originally in `/api/bases/organization_events.py`)
        if "issue" in self.header_fields:
            issue_ids = set(result["issue.id"] for result in result_list)
            issues = {
                i.id: i.qualified_short_id
                for i in Group.objects.filter(
                    id__in=issue_ids,
                    project__in=self.params["project_id"],
                    project__organization_id=self.params["organization_id"],
                )
            }
            for result in result_list:
                if "issue.id" in result:
                    result["issue"] = issues.get(result["issue.id"], "unknown")

        return result_list
