from typing import TypedDict

from rest_framework.exceptions import ValidationError
from rest_framework.fields import CharField, ChoiceField

from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.integrations.aws.client import AWS_MCP_REGIONS, AWS_ROLE_ARN_MESSAGE, parse_role_arn
from sentry.shared_integrations.exceptions import IntegrationConfigurationError


class AwsRoleInput(TypedDict):
    role_arn: str
    region: str


class AwsRoleSerializer(CamelSnakeSerializer[AwsRoleInput]):
    role_arn = CharField(max_length=2048)
    region = ChoiceField(choices=AWS_MCP_REGIONS)

    def validate_role_arn(self, value: str) -> str:
        try:
            return parse_role_arn(value)
        except IntegrationConfigurationError:
            raise ValidationError(AWS_ROLE_ARN_MESSAGE) from None


class AwsVerificationInput(TypedDict):
    verification_receipt: str


class AwsVerificationInputSerializer(CamelSnakeSerializer[AwsVerificationInput]):
    verification_receipt = CharField(max_length=2048)
