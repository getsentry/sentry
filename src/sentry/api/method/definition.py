from functools import wraps


def sentry_api():
    """
    This decorator handles the API overheads like validating and deserializing inputs,
    serializing outputs, paginating lists, and more feature to be added in the future.

    It works with the SentrySchema to document everything around the endpoint.

    ```
    class ApiEndpoint(Endpoint):

        @sentry_api(
            public=True,
            query_params=[Serializer1, Serializer2],
            response_format=Serializer3,
            paginated=True
        )
        def get(self, request, serializer1_obj, serialzer2_obj):
            # Interesting stuff
            return queryset

    Any changes made to this decorator should ensure backwards compatibility with older API's input
    and output types.
    """

    def decorator(endpoint_method):
        @wraps(endpoint_method)
        def drf_view(self, request, *args, **kwargs):
            return endpoint_method(self, request, *args, **kwargs)

        return drf_view

    return decorator
