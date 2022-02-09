from drf_spectacular.utils import OpenApiResponse

RESPONSE_UNAUTHORIZED = OpenApiResponse(description="Unauthorized")

RESPONSE_FORBIDDEN = OpenApiResponse(description="Forbidden")

RESPONSE_NOTFOUND = OpenApiResponse(description="Not Found")

RESPONSE_SUCCESS = OpenApiResponse(description="Success")
