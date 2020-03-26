from __future__ import absolute_import

import logging

from sentry.api.utils import get_date_range_from_params
from sentry.snuba import discover
from sentry.models import Project

from ..base import ExportError
from ..utils import snuba_error_handler

logger = logging.getLogger(__name__)


class DiscoverProcessor(object):
    """
    Processor for exports of discover data based on a provided query
    """

    def __init__(self, organization_id, discover_query):
        self.projects = self.get_projects(discover_query["project"])
        self.start, self.end = get_date_range_from_params(discover_query)
        self.params = {
            "organization_id": organization_id,
            "project_id": [project.id for project in self.projects],
            "start": self.start,
            "end": self.end,
        }
        self.data_fn = self.get_data_fn(
            fields=discover_query["field"], query=discover_query["query"], params=self.params
        )
        with snuba_error_handler(logger=logger):
            sample = self.data_fn(0, 1)["data"]
            if len(sample) == 0:
                raise ExportError("No available data for the provided query")
        self.header_fields = sample[0].keys()

    @staticmethod
    def get_projects(project_ids):
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
                referrer="api.organization-events-v2",
                auto_fields=True,
                use_aggregate_conditions=True,
            )

        return data_fn
