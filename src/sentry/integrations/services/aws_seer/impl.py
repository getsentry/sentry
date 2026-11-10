from __future__ import annotations

from sentry.integrations.aws.client import get_sentry_principal_arn
from sentry.integrations.services.aws_seer.service import AwsSeerService
from sentry.shared_integrations.exceptions import IntegrationConfigurationError


class CellAwsSeerService(AwsSeerService):
    def get_principal_arn(self, *, organization_id: int) -> str | None:
        try:
            return get_sentry_principal_arn()
        except IntegrationConfigurationError:
            return None
