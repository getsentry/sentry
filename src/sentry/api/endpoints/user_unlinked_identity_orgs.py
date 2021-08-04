from rest_framework.response import Response

from sentry.api.bases.user import UserEndpoint
from sentry.api.serializers import serialize
from sentry.models import Identity, IdentityProvider, Integration, ObjectStatus


class UserUnlinkedIdentityOrgsEndpoint(UserEndpoint):
    def get(self, request, user, provider):
        """
        List orgs that have an integration with the given provider w/o a linked identity for the user
        `````````````````````````

        List orgs with unlinked identities (e.g. Slack identities)

        :auth: required
        """
        unlinked_identity_orgs = []
        for org in user.get_orgs():
            try:
                slack_integration = Integration.objects.get(
                    organizations=org, status=ObjectStatus.VISIBLE, provider=provider
                )
            except Integration.DoesNotExist:
                # this org doesn't have that integration, so no identity to find
                continue
            try:
                idp = IdentityProvider.objects.get(
                    external_id=slack_integration.external_id, type=provider
                )
            except IdentityProvider.DoesNotExist:
                continue
            try:
                Identity.objects.get(idp=idp, user=user)
            except Identity.DoesNotExist:
                unlinked_identity_orgs.append(org)

        serialized = serialize(unlinked_identity_orgs)
        return Response(serialized)
