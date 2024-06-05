from rest_framework.exceptions import ParseError
from rest_framework.request import Request

from sentry.auth.elevated_mode import has_elevated_mode
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.indexer.base import to_use_case_id
from sentry.sentry_metrics.use_case_id_registry import (
    UseCaseID,
    UseCaseIDAPIAccess,
    get_use_case_id_api_access,
)


def string_to_use_case_id(value: str) -> UseCaseID:
    try:
        return UseCaseID(value)
    except ValueError:
        # param doesn't appear to be a UseCaseID try with the obsolete UseCaseKey
        # will raise ValueError if it fails
        return to_use_case_id(UseCaseKey(value))


def can_access_use_case_id(request: Request, use_case_id: UseCaseID) -> bool:
    api_access = get_use_case_id_api_access(use_case_id)
    return api_access == UseCaseIDAPIAccess.PUBLIC or (
        has_elevated_mode(request) and api_access == UseCaseIDAPIAccess.PRIVATE
    )


def get_default_use_case_ids(request: Request) -> list[str]:
    """
    Gets the default use case ids given a Request.

    Args:
        request: Request of the endpoint.

    Returns:
        A list of use case ids that can be used for the API request.
    """
    return [
        use_case_id.value
        for use_case_id in UseCaseID
        if can_access_use_case_id(request, use_case_id)
    ]


def get_use_case_id(request: Request) -> UseCaseID:
    """
    Gets the use case id from the Request. If the use case id is malformed or private the entire request will fail.

    Args:
        request: Request of the endpoint.

    Returns:
        The use case id that was request or a default use case id.
    """
    try:
        use_case_id = string_to_use_case_id(request.GET.get("useCase", UseCaseID.SESSIONS.value))
        if not can_access_use_case_id(request, use_case_id):
            raise ParseError(detail="The supplied use case doesn't exist or it's private")

        return use_case_id
    except ValueError:
        raise ParseError(detail="The supplied use case doesn't exist or it's private")


def get_use_case_ids(request: Request) -> list[UseCaseID]:
    """
    Gets the use case ids from the Request. If at least one use case id is malformed or private the entire request
    will fail.

    Args:
        request: Request of the endpoint.

    Returns:
        The use case ids that were requested or the default use case ids.
    """
    try:
        use_case_ids = [
            string_to_use_case_id(use_case_param)
            for use_case_param in request.GET.getlist("useCase", get_default_use_case_ids(request))
        ]
        for use_case_id in use_case_ids:
            if not can_access_use_case_id(request, use_case_id):
                raise ParseError(detail="The supplied use case doesn't exist or it's private")

        return use_case_ids
    except ValueError:
        raise ParseError(detail="One or more supplied use cases doesn't exist or it's private")
