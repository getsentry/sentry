from typing import Any

from sentry.api.serializers import serialize
from sentry.api.serializers.models.groupsearchview import GroupSearchViewSerializer
from sentry.models.groupsearchview import GroupSearchView
from sentry.service_accounts.principal import ServiceAccountPrincipal
from sentry.testutils.cases import TestCase


class GroupSearchViewSerializerTest(TestCase):
    def test_serialize_for_service_account(self) -> None:
        service_account = self.create_service_account(organization=self.organization)
        view = GroupSearchView.objects.create(
            organization=self.organization,
            created_by_service_account_id=service_account.id,
            name="Service Account View",
            query="is:unresolved",
        )
        # request.user is a ServiceAccountPrincipal at runtime, though it isn't typed as one.
        principal: Any = ServiceAccountPrincipal(
            service_account_id=service_account.id,
            organization_id=self.organization.id,
            name=service_account.name,
        )

        result = serialize(
            view, principal, serializer=GroupSearchViewSerializer(organization=self.organization)
        )

        assert result["id"] == str(view.id)
        assert result["createdBy"] is None
        assert result["starred"] is False
        assert result["lastVisited"] is None
