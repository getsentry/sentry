from rest_framework import serializers


class RelayIdSerializer(serializers.Serializer):
    relay_id = serializers.RegexField(
        r"^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$", required=True
    )


from .details import RelayDetailsEndpoint
from .health_check import RelayHealthCheck
from .index import RelayIndexEndpoint
from .project_configs import RelayProjectConfigsEndpoint
from .project_ids import RelayProjectIdsEndpoint
from .public_keys import RelayPublicKeysEndpoint
from .register_challenge import RelayRegisterChallengeEndpoint
from .register_response import RelayRegisterResponseEndpoint

__all__ = (
    "RelayDetailsEndpoint",
    "RelayHealthCheck",
    "RelayIdSerializer",
    "RelayIndexEndpoint",
    "RelayProjectConfigsEndpoint",
    "RelayProjectIdsEndpoint",
    "RelayPublicKeysEndpoint",
    "RelayRegisterChallengeEndpoint",
    "RelayRegisterResponseEndpoint",
)
