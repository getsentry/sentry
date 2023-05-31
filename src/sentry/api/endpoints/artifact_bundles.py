from collections import defaultdict
from typing import Optional

import sentry_sdk
from django.db import router
from django.db.models import Q
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.exceptions import ResourceDoesNotExist, SentryAPIException
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.artifactbundle import ArtifactBundlesSerializer
from sentry.models import ArtifactBundle, ProjectArtifactBundle
from sentry.utils.db import atomic_transaction


class InvalidSortByParameter(SentryAPIException):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "invalid_sort_by_parameter"
    message = "You can either sort via 'date_added' or '-date_added'"


class ArtifactBundlesMixin:
    @classmethod
    def derive_order_by(cls, sort_by: str) -> Optional[str]:
        is_desc = sort_by.startswith("-")
        sort_by = sort_by.strip("-")

        if sort_by == "date_added":
            order_by = "date_uploaded"
            return f"-{order_by}" if is_desc else order_by

        raise InvalidSortByParameter


@region_silo_endpoint
class ArtifactBundlesEndpoint(ProjectEndpoint, ArtifactBundlesMixin):
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

        # TODO: since we do a left join here, in case a bundle has at least one occurrence in the
        #  ReleaseArtifactBundle table, we will not show its variant without a release. For example if a customer
        #  uploads a bundle without a release and then re-uploads the same bundle with a release. We need to see if this
        #  requires work on our end if customers do not like this behavior.
        q = Q()
        if query:
            q |= Q(bundle_id__icontains=query)
            q |= Q(
                releaseartifactbundle__isnull=False,
                releaseartifactbundle__release_name__icontains=query,
            )
            q |= Q(
                releaseartifactbundle__isnull=False,
                releaseartifactbundle__dist_name__icontains=query,
            )
        else:
            q = Q(releaseartifactbundle__isnull=False) | Q(releaseartifactbundle__isnull=True)

        try:
            queryset = ArtifactBundle.objects.filter(
                q,
                organization_id=project.organization_id,
                projectartifactbundle__project_id=project.id,
            ).values_list(
                "bundle_id",
                "releaseartifactbundle__release_name",
                "releaseartifactbundle__dist_name",
                "artifact_count",
                "date_uploaded",
            )
        except ProjectArtifactBundle.DoesNotExist:
            raise ResourceDoesNotExist

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

            all_artifact_bundles = ArtifactBundle.objects.filter(
                organization_id=project.organization_id,
                bundle_id=bundle_id,
                projectartifactbundle__isnull=False,
            )
            # We group the bundles by their id, since we might have multiple bundles with the same bundle_id due to a
            # problem that was fixed in https://github.com/getsentry/sentry/pull/49836.
            grouped_bundles = defaultdict(list)
            for artifact_bundle in all_artifact_bundles:
                grouped_bundles[artifact_bundle.id].append(artifact_bundle)

            # We loop for each group of bundles with the same id, in order to check how many projects are connected to
            # the same bundle.
            for _, artifact_bundles in grouped_bundles:
                # Technically for each bundle we will have always different project ids bound to it but to make the
                # system more robust we compute the set of project ids to work avoid considering duplicates in the
                # next code.
                found_project_ids = set()
                for artifact_bundle in artifact_bundles:
                    found_project_ids.add(artifact_bundle.projectartifactbundle.project_id)

                # In case there are no project ids, which shouldn't happen, there is a db problem, thus we want to track
                # it.
                if len(found_project_ids) == 0:
                    with sentry_sdk.push_scope() as scope:
                        scope.set_tag("project_id", project_id)
                        scope.set_tag("bundle_id", bundle_id)
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
                            artifact_bundles[0].delete()
                        else:
                            for artifact_bundle in artifact_bundles:
                                if project_id == artifact_bundle.projectartifactbundle.project_id:
                                    artifact_bundle.projectartifactbundle.delete()
                else:
                    error = f"Artifact bundle with {bundle_id} found but it is not connected to project {project_id}"

            # TODO: here we might end up having artifact bundles without a project connected, thus it would be better
            #  to also perform deletion of a bundle without any projects.
            if error is None:
                return Response(status=204)
            else:
                return Response({"error": error}, status=404)

        return Response({"error": f"Supplied an invalid bundle_id {bundle_id}"}, status=404)
