from __future__ import absolute_import

import six
from collections import defaultdict

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import (OrganizationMember, OrganizationMemberTeam, Team, TeamStatus)


@register(OrganizationMember)
class OrganizationMemberSerializer(Serializer):
    def get_attrs(self, item_list, user):
        # TODO(dcramer): assert on relations
        users = {d['id']: d for d in serialize(
            set(i.user for i in item_list if i.user_id), user)}

        return {
            item: {
                'user': users[six.text_type(item.user_id)] if item.user_id else None,
            } for item in item_list
        }

    def serialize(self, obj, attrs, user):
        d = {
            'id': six.text_type(obj.id),
            'email': obj.get_email(),
            'name': obj.user.get_display_name() if obj.user else obj.get_email(),
            'user': attrs['user'],
            'role': obj.role,
            'roleName': obj.get_role_display(),
            'pending': obj.is_pending,
            'flags': {
                'sso:linked': bool(getattr(obj.flags, 'sso:linked')),
                'sso:invalid': bool(getattr(obj.flags, 'sso:invalid')),
            },
            'dateCreated': obj.date_added,
        }
        return d


class OrganizationMemberWithTeamsSerializer(OrganizationMemberSerializer):
    def get_attrs(self, item_list, user):
        attrs = super(OrganizationMemberWithTeamsSerializer,
                      self).get_attrs(item_list, user)

        member_team_map = list(OrganizationMemberTeam.objects.filter(
            team__status=TeamStatus.VISIBLE,
            organizationmember__in=item_list,
        ).values_list(
            'organizationmember_id', 'team_id'
        ))

        teams = {team.id: team for team in Team.objects.filter(
            id__in=[team_id for _, team_id in member_team_map])}
        results = defaultdict(list)

        # results is a map of member id -> team_slug[]
        for member_id, team_id in member_team_map:
            results[member_id].append(
                teams[team_id].slug)

        for item in item_list:
            teams = results.get(item.id, [])
            try:
                attrs[item]['teams'] = teams
            except KeyError:
                attrs[item] = {
                    'teams': teams
                }

        return attrs

    def serialize(self, obj, attrs, user):
        d = super(OrganizationMemberWithTeamsSerializer,
                  self).serialize(obj, attrs, user)

        d['teams'] = attrs.get('teams', [])

        return d
