from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.models.project import Project
from sentry.search.utils import parse_datetime_string
from sentry.tasks.statistical_detectors import (
    _detect_function_change_points,
    _detect_transaction_change_points,
)


@region_silo_endpoint
class ProjectStatisticalDetectors(ProjectEndpoint):
    owner = ApiOwner.PROFILING
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    enforce_rate_limit = True

    def get(self, request: Request, project: Project) -> Response:
        try:
            timestamp = parse_datetime_string(request.GET["end"])
        except KeyError:
            return Response(
                status=status.HTTP_400_BAD_REQUEST,
                data={"details": "Missing required argument: end"},
            )
        except Exception:
            return Response(
                status=status.HTTP_400_BAD_REQUEST,
                data={"details": "Invalid value for end"},
            )

        transaction = request.GET.get("transaction")
        if transaction is not None:
            _detect_transaction_change_points([(project.id, transaction)], timestamp)
            return Response(status=status.HTTP_202_ACCEPTED)

        fingerprint = request.GET.get("function")
        if fingerprint is not None:
            try:
                function = int(fingerprint)
            except ValueError:
                return Response(
                    status=status.HTTP_400_BAD_REQUEST,
                    data={"details": "Invalid fingerprint"},
                )
            _detect_function_change_points([(project.id, function)], timestamp)
            return Response(status=status.HTTP_202_ACCEPTED)

        return Response(
            status=status.HTTP_400_BAD_REQUEST,
            data={"details": "Missing transaction or fingerprint"},
        )
