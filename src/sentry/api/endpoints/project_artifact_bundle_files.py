# from sentry.api.base import region_silo_endpoint
# from sentry.api.bases import ProjectEndpoint, ProjectReleasePermission
# from sentry.ratelimits.config import SENTRY_RATELIMITER_GROUP_DEFAULTS, RateLimitConfig
# import logging
# import re
# from typing import List, Optional, Tuple
#
# from django.db import IntegrityError, router
# from django.db.models import Q
# from django.utils.functional import cached_property
# from rest_framework.request import Request
# from rest_framework.response import Response
#
# from sentry.api.base import region_silo_endpoint
# from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
# from sentry.api.exceptions import ResourceDoesNotExist
# from sentry.api.paginator import ChainPaginator
# from sentry.api.serializers import serialize
# from sentry.constants import MAX_RELEASE_FILES_OFFSET
# from sentry.models import Distribution, File, Release, ReleaseFile
# from sentry.models.releasefile import read_artifact_index
# from sentry.ratelimits.config import SENTRY_RATELIMITER_GROUP_DEFAULTS, RateLimitConfig
# from sentry.utils.db import atomic_transaction
#
# @region_silo_endpoint
# class ProjectArtifactBundleFilesEndpoint(ProjectEndpoint):
#     permission_classes = (ProjectReleasePermission,)
#     rate_limits = RateLimitConfig(
#         group="CLI", limit_overrides={"GET": SENTRY_RATELIMITER_GROUP_DEFAULTS["default"]}
#     )
#
#     def get(self, request: Request, project, version) -> Response:
#         """
#         List a Project Artifact Bundle's Files
#         ``````````````````````````````
#
#         Retrieve a list of artifact bundle files for a given artifact bundle.
#
#         :pparam string organization_slug: the slug of the organization the
#                                           release belongs to.
#         :pparam string project_slug: the slug of the project to list the
#                                      release files of.
#         :pparam string version: the version identifier of the release.
#         :qparam string query: If set, only files with these partial names will be returned.
#         :qparam string checksum: If set, only files with these exact checksums will be returned.
#         :auth: required
#         """
#         try:
#             release = Release.objects.get(
#                 organization_id=project.organization_id, projects=project, version=version
#             )
#         except Release.DoesNotExist:
#             raise ResourceDoesNotExist
#
#         return self.get_releasefiles(request, release, project.organization_id)
