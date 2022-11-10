from functools import wraps


def sentry_api():
    """
    This decorator defines the input/output of an endpoint method while taking care of overheads like validation,
    all while documenting the method.
    """

    def decorator(endpoint_method):
        @wraps(endpoint_method)
        def drf_view(self, request, *args, **kwargs):
            return endpoint_method(self, request, *args, **kwargs)

        return drf_view

    return decorator
