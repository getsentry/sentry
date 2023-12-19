import uuid
from collections import defaultdict
from typing import Optional

import sentry_sdk
from django.db import router
from django.db.models import Q
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.exceptions import ResourceDoesNotExist, SentryAPIException
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.artifactbundle import ArtifactBundlesSerializer
from sentry.models.artifactbundle import ArtifactBundle, ProjectArtifactBundle
from sentry.utils.db import atomic_transaction

# We want to keep a mapping of the fields that the frontend uses for filtering since we want to align the UI names and
# restrict the number of order by fields that are possible in the API.
ORDER_BY_FIELDS_MAPPING = {"date_added": "date_uploaded", "date_modified": "date_last_modified"}


class InvalidSortByParameter(SentryAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "invalid_sort_by_parameter"
    message = "You can either sort via 'date_added' or 'date_modified'"


class ArtifactBundlesMixin:
    @classmethod
    def derive_order_by(cls, sort_by: str) -> Optional[str]:
        is_desc = sort_by.startswith("-")
        sort_by = sort_by.strip("-")

        order_by = ORDER_BY_FIELDS_MAPPING.get(sort_by)
        if order_by is not None:
            return f"-{order_by}" if is_desc else order_by

        raise InvalidSortByParameter

    @classmethod
    def is_valid_uuid(cls, value):
        try:
            uuid.UUID(str(value))
            return True
        except ValueError:
            return False


@region_silo_endpoint
class ArtifactBundlesEndpoint(ProjectEndpoint, ArtifactBundlesMixin):
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    permission_classes = (ProjectReleasePermission,)

    def get(self, request: Request, project) -> Response:
        """
        List a Project's Artifact Bundles
        ````````````````````````````````````

        Retrieve a list of artifact bundles for a given project.

        :pparam string organization_slug: the slug of the organization the
                                          artifact bundle belongs to.
        :pparam string project_slug: the slug of the project to list the
                                     artifact bundles of.
        """
        query = request.GET.get("query")

        try:
            queryset = (
                ArtifactBundle.objects.filter(
                    organization_id=project.organization_id,
                    projectartifactbundle__project_id=project.id,
                ).values_list(
                    "id", "bundle_id", "artifact_count", "date_last_modified", "date_uploaded"
                )
                # We want to use the more efficient DISTINCT ON.
                .distinct(
                    "id", "bundle_id", "artifact_count", "date_last_modified", "date_uploaded"
                )
            )
        except ProjectArtifactBundle.DoesNotExist:
            raise ResourceDoesNotExist

        if query:
            # By default, we want to exact match the release or dist.
            query_q = Q(releaseartifactbundle__release_name=query) | Q(
                releaseartifactbundle__dist_name=query
            )

            # In case the query contains an actual UUID, we will also try to match the bundle id or debug id. Checking
            # for the type before making the query saves us one join when not needed.
            if self.is_valid_uuid(query):
                query_q |= Q(bundle_id=query) | Q(debugidartifactbundle__debug_id=query)

            # At the end we apply the chain of OR filters to the query. In case both the release and debug ids tables
            # are used, we will make two left outer joins.
            queryset = queryset.filter(query_q)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=self.derive_order_by(sort_by=request.GET.get("sortBy", "-date_added")),
            paginator_cls=OffsetPaginator,
            default_per_page=10,
            on_results=lambda r: serialize(r, request.user, ArtifactBundlesSerializer()),
        )

    def delete(self, request: Request, project) -> Response:
        """
        Delete an Archive
        ```````````````````````````````````````````````````

        Delete all artifacts inside given archive.

        :pparam string organization_slug: the slug of the organization the
                                            archive belongs to.
        :pparam string project_slug: the slug of the project to delete the
                                        archive of.
        :qparam string name: The name of the archive to delete.
        :auth: required
        """

        project_id = project.id
        bundle_id = request.GET.get("bundleId")

        if bundle_id:
            error = None

            project_artifact_bundles = ProjectArtifactBundle.objects.filter(
                organization_id=project.organization_id,
                artifact_bundle__bundle_id=bundle_id,
            ).select_related("artifact_bundle")
            # We group the bundles by their id, since we might have multiple bundles with the same bundle_id due to a
            # problem that was fixed in https://github.com/getsentry/sentry/pull/49836.
            grouped_bundles = defaultdict(list)
            for project_artifact_bundle in project_artifact_bundles:
                grouped_bundles[project_artifact_bundle.artifact_bundle].append(
                    project_artifact_bundle
                )

            # We loop for each group of bundles with the same id, in order to check how many projects are connected to
            # the same bundle.
            for artifact_bundle, project_artifact_bundles in grouped_bundles.items():
                # Technically for each bundle we will have always different project ids bound to it but to make the
                # system more robust we compute the set of project ids to work avoid considering duplicates in the
                # next code.
                found_project_ids = set()
                for project_artifact_bundle in project_artifact_bundles:
                    found_project_ids.add(project_artifact_bundle.project_id)

                # In case there are no project ids, which shouldn't happen, there is a db problem, thus we want to track
                # it.
                if len(found_project_ids) == 0:
                    with sentry_sdk.push_scope() as scope:
                        scope.set_tag("bundle_id", bundle_id)
                        scope.set_tag("org_id", project.organization.id)
                        sentry_sdk.capture_message(
                            "An artifact bundle without project(s) has been detected."
                        )

                    break

                has_one_project_left = len(found_project_ids) == 1
                if project_id in found_project_ids:
                    # We delete the ProjectArtifactBundle entries that are bound to project requesting the deletion.
                    with atomic_transaction(
                        using=(
                            router.db_for_write(ArtifactBundle),
                            router.db_for_write(ProjectArtifactBundle),
                        )
                    ):
                        if has_one_project_left:
                            # If there is one project id we know that artifact_bundles must contain at least one
                            # element, so we just take it out and delete it. This deletion will cascade delete every
                            # connected entity.
                            artifact_bundle.delete()
                        else:
                            # If there is more than one project, we will just delete the ProjectArtifactBundle entry
                            # corresponding to project id of the requesting project.
                            for project_artifact_bundle in project_artifact_bundles:
                                if project_id == project_artifact_bundle.project_id:
                                    project_artifact_bundle.delete()
                else:
                    error = f"Artifact bundle with {bundle_id} found but it is not connected to project {project_id}"

            # TODO: here we might end up having artifact bundles without a project connected, thus it would be better
            #  to also perform deletion of a bundle without any projects.
            if error is None:
                return Response(status=204)
            else:
                return Response({"error": error}, status=404)

        return Response({"error": f"Supplied an invalid bundle_id {bundle_id}"}, status=404)
