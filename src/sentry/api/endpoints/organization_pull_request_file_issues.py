from __future__ import annotations

from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.snuba.referrer import Referrer
from sentry.tasks.integrations.github.language_parsers import PATCH_PARSERS
from sentry.tasks.integrations.github.open_pr_comment import (
    get_projects_and_filenames_from_source_file,
    get_top_issues_by_count_for_file,
)


class PullRequestFileSerializer(serializers.Serializer):
    filename = serializers.CharField(required=True)
    repo = serializers.CharField(required=True)
    patch = serializers.CharField(required=True)
    limit = serializers.IntegerField(required=False, default=5)

    def validate_filename(self, value):
        if not value:
            raise serializers.ValidationError("Filename is required")

        file_extension = value.split(".")[-1]
        language_parser = PATCH_PARSERS.get(file_extension, None)
        if not language_parser:
            raise serializers.ValidationError("Unsupported file type")

        return value

    def validate_limit(self, value):
        if value and value < 1 or value > 100:
            raise serializers.ValidationError("Issue count must be between 1 and 100")

        return value


@region_silo_endpoint
class OrganizationPullRequestFilesIssuesEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ECOSYSTEM
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }

    def post(self, request: Request, organization: Organization) -> Response:
        serializer = PullRequestFileSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        filename = serializer.validated_data["filename"]
        repo_name = serializer.validated_data["repo"]
        patch = serializer.validated_data["patch"]
        limit = serializer.validated_data["limit"]

        projects, sentry_filenames = get_projects_and_filenames_from_source_file(
            org_id=organization.id, repo_name=repo_name, pr_filename=filename
        )

        if not len(projects) or not len(sentry_filenames):
            return Response([])

        file_extension = filename.split(".")[-1]
        language_parser = PATCH_PARSERS[file_extension]

        function_names = language_parser.extract_functions_from_patch(patch)

        if not len(function_names):
            return Response([])

        top_issues = get_top_issues_by_count_for_file(
            projects=list(projects),
            sentry_filenames=list(sentry_filenames),
            function_names=list(function_names),
            limit=limit,
        )

        group_id_to_info = {}
        for issue in top_issues:
            group_id = issue["group_id"]
            group_id_to_info[group_id] = dict(filter(lambda k: k[0] != "group_id", issue.items()))

        issues = Group.objects.filter(id__in=list(group_id_to_info.keys())).all()

        pr_file_issues = [
            {
                "title": issue.title,
                "culprit": issue.culprit,
                "url": issue.get_absolute_url(),
                "affected_users": issue.count_users_seen(
                    referrer=Referrer.TAGSTORE_GET_GROUPS_USER_COUNTS_OPEN_PR_COMMENT.value
                ),
                "event_count": group_id_to_info[issue.id]["event_count"],
                "function_name": group_id_to_info[issue.id]["function_name"],
            }
            for issue in issues
        ]
        pr_file_issues.sort(key=lambda k: k.get("event_count", 0), reverse=True)

        return Response(pr_file_issues)
