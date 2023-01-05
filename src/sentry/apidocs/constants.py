from drf_spectacular.utils import OpenApiResponse

RESPONSE_UNAUTHORIZED = OpenApiResponse(description="Unauthorized")

# 400
RESPONSE_BAD_REQUEST = OpenApiResponse(description="Bad Request")

RESPONSE_FORBIDDEN = OpenApiResponse(description="Forbidden")

RESPONSE_NOTFOUND = OpenApiResponse(description="Not Found")

# 200
RESPONSE_SUCCESS = OpenApiResponse(description="Success")

# 201 - Created
RESPONSE_NO_CONTENT = OpenApiResponse(description="No Content")

# 202 - Accepted (not yet acted on fully)
RESPONSE_ACCEPTED = OpenApiResponse(description="Accepted")

# 208
RESPONSE_ALREADY_REPORTED = OpenApiResponse(description="Already Reported")
