from rest_framework.response import Response

from sentry.api.bases.user import UserEndpoint
from sentry.api.serializers import serialize
from sentry.models import Identity, IdentityProvider, OrganizationIntegration, Integration, ObjectStatus


class UserUnlinkedIdentitiesEndpoint(UserEndpoint):
    def get(self, request, user):
        """
        List A User's Unlinked Identities for the Given Provider
        `````````````````````````

        List a user account's unlinked identities (e.g. Slack identities)

        :auth: required
        """
        print("~~~~~~")
        unlinked_identities = []
        for org in user.get_orgs():
            try:
                slack_integration = Integration.objects.get(
                    organizations=org, status=ObjectStatus.VISIBLE, provider="slack"
                )
            except Integration.DoesNotExist:
                # this org doesn't have that integration, so no identity to find
                unlinked_identities.append(org.slug)
                continue
            try:
                idp = IdentityProvider.objects.get(
                        external_id=slack_integration.external_id, type="slack"
                    )
            except IdentityProvider.DoesNotExist:
                continue
            try:
                identity = Identity.objects.get(
                        idp=idp, user=user
                    )
            except Identity.DoesNotExist:
                unlinked_identities.append(org.slug)
                continue

        print("unlinked orgs: ", unlinked_identities)
        return unlinked_identities
        # identity_list = list(Identity.objects.filter(user=user))
        # return Response(serialize(identity_list))

    def unlinked_identities(user):
        pass
        # get the users' orgs
        # for each org:
        #     get the org's slack integration
        #     look up the idp using the integration's external id
        #     look up the user's identity using the idp and user
        #     if there is not a match, add that org to the list of unlinked identities
