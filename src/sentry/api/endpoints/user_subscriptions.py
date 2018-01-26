from __future__ import absolute_import

from django.utils import timezone
from rest_framework.response import Response
from rest_framework import status

from sentry.app import newsletter
from sentry.api.bases.user import UserEndpoint
from sentry.models import UserEmail


class UserSubscriptionsEndpoint(UserEndpoint):
    def get(self, request, user):
        """
        Retrieve Account Subscriptions
        `````````````````````````````````````

        Return list of subscriptions for an account

        :auth: required
        """

        # This returns a dict with `subscriber` and `subscriptions`
        # Returns `None` if no subscriptions for user
        sub = newsletter.get_subscriptions(user)

        if sub is None or not newsletter.is_enabled:
            return Response([])

        try:
            return Response([{
                'listId': x['list_id'],
                'listDescription': x['list_description'],
                'listName': x['list_name'],
                'email': x['email'],
                'subscribed': x['subscribed'],
                'subscribedDate': x['subscribed_date'],
                'unsubscribedDate': x['unsubscribed_date'],
            } for x in sub['subscriptions']])
        except KeyError:
            return Response([])

    def put(self, request, user):
        """
        Update Account Subscriptionsoptions
        `````````````````````````````````

        Update account subscriptions to newsletter

        :param int listId: id of newsletter list
        :param boolean subscribed: should be subscribed to newsletter
        :auth: required
        """

        email = UserEmail.get_primary_email(user)

        # Can't handle subscriptions without a verified email
        if not email.is_verified:
            return Response({'details': 'Must have verified email to subscribe to newsletter.'},
                            status=status.HTTP_400_BAD_REQUEST)

        subscribed = request.DATA.get('subscribed')
        try:
            list_id = int(request.DATA.get('listId', ''))
        except ValueError:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        kwargs = {
            'list_id': list_id,
            'subscribed': subscribed,
            'verified': email.is_verified,
        }
        if not subscribed:
            kwargs['unsubscribed_date'] = timezone.now()
        else:
            kwargs['subscribed_date'] = timezone.now()

        newsletter.create_or_update_subscription(user, **kwargs)
        return Response(status=status.HTTP_204_NO_CONTENT)
