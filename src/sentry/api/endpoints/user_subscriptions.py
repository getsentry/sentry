from django.db.models import F
from django.utils import timezone
from rest_framework import serializers

from sentry import newsletter
from sentry.api.bases.user import UserEndpoint
from sentry.models import User, UserEmail


class DefaultNewsletterValidator(serializers.Serializer):
    subscribed = serializers.BooleanField(required=True)


class NewsletterValidator(serializers.Serializer):
    listId = serializers.IntegerField(required=True)
    subscribed = serializers.BooleanField(required=True)


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
        if sub is None or not newsletter.is_enabled():
            return self.respond([])

        return self.respond(
            [
                {
                    "listId": x.get("list_id"),
                    "listDescription": x.get("list_description"),
                    "listName": x.get("list_name"),
                    "email": x.get("email"),
                    "subscribed": x.get("subscribed"),
                    "subscribedDate": x.get("subscribed_date"),
                    "unsubscribedDate": x.get("unsubscribed_date"),
                }
                for x in sub["subscriptions"]
            ]
        )

    def put(self, request, user):
        """
        Update Account Subscriptions
        ````````````````````````````

        Update account subscriptions to newsletter

        :param int listId: id of newsletter list
        :param boolean subscribed: should be subscribed to newsletter
        :auth: required
        """
        validator = NewsletterValidator(data=request.data)
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        result = validator.validated_data
        email = UserEmail.get_primary_email(user)

        kwargs = {
            "list_id": result["listId"],
            "subscribed": result["subscribed"],
            "verified": email.is_verified,
        }
        if not result["subscribed"]:
            kwargs["unsubscribed_date"] = timezone.now()
        else:
            kwargs["subscribed_date"] = timezone.now()

        newsletter.create_or_update_subscription(user, **kwargs)
        return self.respond(status=204)

    def post(self, request, user):
        """
        Configure Newsletter Subscription
        `````````````````````````````````

        Update the default newsletter subscription.

        :param boolean subscribed: should be subscribed to newsletter
        :auth: required
        """
        validator = DefaultNewsletterValidator(data=request.data)
        if not validator.is_valid():
            return self.respond(validator.errors, status=400)

        result = validator.validated_data
        email = UserEmail.get_primary_email(user)

        kwargs = {
            "subscribed": result["subscribed"],
            "verified": email.is_verified,
            "list_ids": newsletter.get_default_list_ids(),
        }
        if not result["subscribed"]:
            kwargs["unsubscribed_date"] = timezone.now()
        else:
            kwargs["subscribed_date"] = timezone.now()

        newsletter.create_or_update_subscriptions(user, **kwargs)

        user.update(flags=F("flags").bitand(~User.flags.newsletter_consent_prompt))

        return self.respond(status=204)
