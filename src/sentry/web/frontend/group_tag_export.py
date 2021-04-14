from django.http import Http404

from sentry.api.base import EnvironmentMixin
from sentry.data_export.base import ExportError
from sentry.data_export.processors.issues_by_tag import IssuesByTagProcessor
from sentry.models import Environment
from sentry.web.frontend.base import ProjectView
from sentry.web.frontend.mixins.csv import CsvMixin


class GroupTagExportView(ProjectView, CsvMixin, EnvironmentMixin):
    required_scope = "event:read"

    def get_header(self, key):
        return tuple(IssuesByTagProcessor.get_header_fields(key))

    def get_row(self, item, key):
        fields = IssuesByTagProcessor.get_header_fields(key)
        item_dict = IssuesByTagProcessor.serialize_row(item, key)
        return (item_dict[field] for field in fields)

    def get(self, request, organization, project, group_id, key):

        # If the environment doesn't exist then the tag can't possibly exist
        try:
            environment_id = self._get_environment_id_from_request(request, project.organization_id)
        except Environment.DoesNotExist:
            raise Http404

        try:
            processor = IssuesByTagProcessor(
                project_id=project.id, group_id=group_id, key=key, environment_id=environment_id
            )
        except ExportError:
            raise Http404

        filename = f"{processor.group.qualified_short_id or processor.group.id}-{key}"

        return self.to_csv_response(processor.get_raw_data(), filename, key=key)
