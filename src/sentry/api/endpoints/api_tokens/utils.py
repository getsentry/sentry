from rest_framework.request import Request

from sentry.auth.superuser import is_active_superuser


def get_appropriate_user_id(request: Request) -> str:
    """
    Gets the user id to use for the request, based on what the current state of the request is.
    If the request is made by a superuser, then they are allowed to act on behalf of other user's data.
    Therefore, when GET or DELETE endpoints are invoked by the superuser, we may utilize a provided user_id.

    The user_id to use comes from the GET or BODY parameter based on the request type.
    For GET endpoints, the GET dict is used.
    For all others, the DATA dict is used.
    """
    # Get the user id for the user that made the current request as a baseline default
    user_id = request.user.id
    if is_active_superuser(request):
        datastore = request.GET if request.GET else request.data
        # If a userId override is not found, use the id for the user who made the request
        user_id = datastore.get("userId", user_id)

    return user_id
