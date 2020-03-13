from __future__ import absolute_import

from django.http import Http404

from sentry.api.base import EnvironmentMixin
from sentry.models import Environment

from sentry.processing.base import ProcessingError
from sentry.processing.issues_by_tag import (
    get_fields,
    get_lookup_key,
    get_project_and_group,
    get_eventuser_callback,
    get_issues_list,
    validate_tag_key,
    serialize_issue,
)
from sentry.web.frontend.base import ProjectView
from sentry.web.frontend.mixins.csv import CsvMixin


class GroupTagExportView(ProjectView, CsvMixin, EnvironmentMixin):
    required_scope = "event:read"

    def get_header(self, key):
        return tuple(get_fields(key))

    def get_row(self, item, key):
        fields = get_fields(key)
        item_dict = serialize_issue(item, key)
        return (item_dict[field] for field in fields)

    def get(self, request, organization, project, group_id, key):
        try:
            _, group = get_project_and_group(project.id, group_id)
        except ProcessingError:
            raise Http404

        lookup_key = get_lookup_key(key)

        # If the environment doesn't exist then the tag can't possibly exist
        try:
            environment_id = self._get_environment_id_from_request(request, project.organization_id)
        except Environment.DoesNotExist:
            raise Http404

        try:
            validate_tag_key(project.id, environment_id, lookup_key)
        except ProcessingError:
            raise Http404

        callbacks = [get_eventuser_callback(group.project_id)] if key == "user" else []

        gtv_iter = get_issues_list(
            project_id=group.project_id,
            group_id=group.id,
            environment_id=environment_id,
            key=lookup_key,
            callbacks=callbacks,
        )

        filename = u"{}-{}".format(group.qualified_short_id or group.id, key)

        return self.to_csv_response(gtv_iter, filename, key=key)
