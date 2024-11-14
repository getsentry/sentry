from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist

VALID_PROVIDERS = {"launchdarkly"}


class OrganizationFlagsEndpoint(OrganizationEndpoint):

    def convert_args(self, *args, **kwargs):
        if kwargs.get("provider", "") not in VALID_PROVIDERS:
            raise ResourceDoesNotExist
        return super().convert_args(*args, **kwargs)
