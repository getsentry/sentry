from __future__ import absolute_import

from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from sentry import newsletter
from sentry.api.base import Endpoint
from sentry.models import UserEmail


class AccountSubscriptionsEndpoint(Endpoint):
    permission_classes = (IsAuthenticated, )

    def get(self, request):
        """
        Retrieve Account Subscriptions
        `````````````````````````````````````

        Return list of subscriptions for an account

        :auth: required
        """

        # This returns a dict with `subscriber` and `subscriptions`
        # Returns `None` if no subscriptions for user
        sub = newsletter.get_subscriptions(request.user)

        if sub is None or not newsletter.is_enabled:
            return Response([])

        try:
            return Response(sub['subscriptions'])
        except KeyError:
            return Response([])

    def put(self, request):
        """
        Update Account Appearance options
        `````````````````````````````````

        Update account appearance options. Only supplied values are updated.

        :param int list_id: id of newsletter list
        :param boolean subscribed: should be subscribed to newsletter
        :auth: required
        """

        user = request.user
        email = UserEmail.get_primary_email(user)
        subscribed = request.DATA.get('subscribed') == '1'
        try:
            list_id = int(request.DATA.get('list_id', ''))
        except ValueError:
            return Response(status=400)

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
        return Response(status=204)
