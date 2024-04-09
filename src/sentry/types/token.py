from django.db import models


class AuthTokenType(models.TextChoices):
    """
    Represents the various API/auth token types in the Sentry code base.
    The values equate to the expected prefix of each of the token types.
    """

    USER = "sntryu_"
    ORG = "sntrys_"
    USER_APP = "sntrya_"
    INTEGRATION = "sntryi_"

    # tokens created prior to our prefixing
    __empty__ = None
