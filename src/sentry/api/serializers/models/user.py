from collections import defaultdict

from django.conf import settings

from sentry import experiments
from sentry.api.serializers import Serializer, register
from sentry.app import env
from sentry.auth.superuser import is_active_superuser
from sentry.models import (
    Authenticator,
    AuthIdentity,
    OrganizationMember,
    OrganizationStatus,
    User,
    UserAvatar,
    UserEmail,
    UserOption,
    UserPermission,
)
from sentry.utils.avatar import get_gravatar_url


def manytoone_to_dict(queryset, key, filter_func=None):
    result = defaultdict(list)
    for row in queryset:
        if filter_func and not filter_func(row):
            continue
        result[getattr(row, key)].append(row)
    return result


@register(User)
class UserSerializer(Serializer):
    def _get_identities(self, item_list, user):
        if not (env.request and is_active_superuser(env.request)):
            item_list = [x for x in item_list if x == user]

        queryset = AuthIdentity.objects.filter(user__in=item_list).select_related(
            "auth_provider", "auth_provider__organization"
        )

        results = {i.id: [] for i in item_list}
        for item in queryset:
            results[item.user_id].append(item)
        return results

    def get_attrs(self, item_list, user):
        avatars = {a.user_id: a for a in UserAvatar.objects.filter(user__in=item_list)}
        identities = self._get_identities(item_list, user)

        emails = manytoone_to_dict(UserEmail.objects.filter(user__in=item_list), "user_id")
        authenticators = Authenticator.objects.bulk_users_have_2fa([i.id for i in item_list])

        data = {}
        for item in item_list:
            data[item] = {
                "avatar": avatars.get(item.id),
                "identities": identities.get(item.id),
                "has2fa": authenticators[item.id],
                "emails": emails[item.id],
            }
        return data

    def serialize(self, obj, attrs, user):
        experiment_assignments = experiments.all(user=user)

        d = {
            "id": str(obj.id),
            "name": obj.get_display_name(),
            "username": obj.username,
            "email": obj.email,
            "avatarUrl": get_gravatar_url(obj.email, size=32),
            "isActive": obj.is_active,
            "hasPasswordAuth": obj.password not in ("!", ""),
            "isManaged": obj.is_managed,
            "dateJoined": obj.date_joined,
            "lastLogin": obj.last_login,
            "has2fa": attrs["has2fa"],
            "lastActive": obj.last_active,
            "isSuperuser": obj.is_superuser,
            "isStaff": obj.is_staff,
            "experiments": experiment_assignments,
        }

        if obj == user:
            options = {
                o.key: o.value for o in UserOption.objects.filter(user=user, project__isnull=True)
            }
            stacktrace_order = int(options.get("stacktrace_order", -1) or -1)

            d["options"] = {
                "theme": options.get("theme") or "light",
                "language": options.get("language") or "en",
                "stacktraceOrder": stacktrace_order,
                "timezone": options.get("timezone") or settings.SENTRY_DEFAULT_TIME_ZONE,
                "clock24Hours": options.get("clock_24_hours") or False,
            }

            d["flags"] = {"newsletter_consent_prompt": bool(obj.flags.newsletter_consent_prompt)}

        if attrs.get("avatar"):
            avatar = {
                "avatarType": attrs["avatar"].get_avatar_type_display(),
                "avatarUuid": attrs["avatar"].ident if attrs["avatar"].file_id else None,
            }
        else:
            avatar = {"avatarType": "letter_avatar", "avatarUuid": None}
        d["avatar"] = avatar

        # TODO(dcramer): move this to DetailedUserSerializer
        if attrs["identities"] is not None:
            d["identities"] = [
                {
                    "id": str(i.id),
                    "name": i.ident,
                    "organization": {
                        "slug": i.auth_provider.organization.slug,
                        "name": i.auth_provider.organization.name,
                    },
                    "provider": {
                        "id": i.auth_provider.provider,
                        "name": i.auth_provider.get_provider().name,
                    },
                    "dateSynced": i.last_synced,
                    "dateVerified": i.last_verified,
                }
                for i in attrs["identities"]
            ]

        d["emails"] = [
            {"id": str(e.id), "email": e.email, "is_verified": e.is_verified}
            for e in attrs["emails"]
        ]

        return d


class DetailedUserSerializer(UserSerializer):
    def get_attrs(self, item_list, user):
        attrs = super().get_attrs(item_list, user)

        # ignore things that aren't user controlled (like recovery codes)
        authenticators = manytoone_to_dict(
            Authenticator.objects.filter(user__in=item_list),
            "user_id",
            lambda x: not x.interface.is_backup_interface,
        )

        permissions = manytoone_to_dict(
            UserPermission.objects.filter(user__in=item_list), "user_id"
        )

        memberships = manytoone_to_dict(
            OrganizationMember.objects.filter(
                user__in=item_list, organization__status=OrganizationStatus.VISIBLE
            ),
            "user_id",
        )

        for item in item_list:
            attrs[item]["authenticators"] = authenticators[item.id]
            attrs[item]["permissions"] = permissions[item.id]

            # org can reset 2FA if the user is only in one org
            attrs[item]["canReset2fa"] = len(memberships[item.id]) == 1

        return attrs

    def serialize(self, obj, attrs, user):
        d = super().serialize(obj, attrs, user)
        # XXX(dcramer): we don't use is_active_superuser here as we simply
        # want to tell the UI that we're an authenticated superuser, and
        # for requests that require an *active* session, they should prompt
        # on-demand. This ensures things like links to the Sentry admin can
        # still easily be rendered.
        d["isSuperuser"] = obj.is_superuser
        d["permissions"] = [up.permission for up in attrs["permissions"]]
        d["authenticators"] = [
            {
                "id": str(a.id),
                "type": a.interface.interface_id,
                "name": str(a.interface.name),
                "dateCreated": a.created_at,
                "dateUsed": a.last_used_at,
            }
            for a in attrs["authenticators"]
        ]
        d["canReset2fa"] = attrs["canReset2fa"]
        return d
