from typing import Literal, NotRequired, TypedDict

from rest_framework import serializers


class OAuthAuthorizeQuery(TypedDict):
    client_id: str
    response_type: Literal["code", "token"]
    redirect_uri: NotRequired[str]
    scope: NotRequired[str]
    state: NotRequired[str]
    code_challenge: NotRequired[str]
    code_challenge_method: NotRequired[str]


class OAuthAuthorizeQuerySerializer(serializers.Serializer[OAuthAuthorizeQuery]):
    client_id = serializers.CharField(trim_whitespace=False)
    response_type = serializers.ChoiceField(choices=("code", "token"))
    redirect_uri = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False)
    scope = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False)
    state = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False)
    code_challenge = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False)
    # Protocol validation runs after the registered callback has been verified.
    code_challenge_method = serializers.CharField(
        required=False,
        allow_blank=True,
        trim_whitespace=False,
        help_text="Must be S256 when code_challenge is supplied.",
    )
