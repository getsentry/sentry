from __future__ import absolute_import

from django.db.models import Q

from collections import defaultdict

from social_auth.models import UserSocialAuth

from sentry.api.serializers import Serializer
from sentry.models import Integration


class ProviderSerializer(Serializer):
    def __init__(self, organization):
        self.organization = organization

    def get_attrs(self, item_list, user, *args, **kwargs):
        integrations = list(Integration.objects.filter(organizations=self.organization))
        integrations_for_org = defaultdict(list)

        for i in integrations:
            integrations_for_org[i.provider].append(i)

        auth_ids = [i.default_auth_id for i in integrations if i.default_auth_id is not None]

        social_auths = defaultdict(list)
        usas = UserSocialAuth.objects.filter(
            Q(id__in=auth_ids) | Q(user=user),
        ).select_related('user')
        for usa in usas:
            social_auths[usa.provider].append(usa)

        return {
            p: {
                'integrations': integrations_for_org[p.id],
                'social_auths': social_auths[p.id],
            } for p in item_list
        }

    def serialize(self, obj, attrs, user):
        integrations = attrs['integrations']
        social_auths = attrs['social_auths']

        return {
            'id': obj.id,
            'name': obj.name,
            'auths': obj.get_available_auths(user, self.organization, integrations, social_auths),
        }
