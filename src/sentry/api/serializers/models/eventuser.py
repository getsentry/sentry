from __future__ import absolute_import

import six

from django.db.models import Q
from operator import or_
from six.moves import reduce

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import EventUser, EventUserLocation, Group, GroupTagValue
from sentry.utils.avatar import get_gravatar_url


@register(EventUser)
class EventUserSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        # TODO(dcramer): these are slow, and would have to be replaced in prod
        # find last location
        try:
            last_location = EventUserLocation.objects.filter(
                event_user_id=obj.id,
            ).order_by('-last_seen')[0]
        except IndexError:
            last_location = None

        # find last issue
        other_eusers = obj.find_similar_users(user)
        event_users = [obj] + list(other_eusers)

        tag_filters = [
            Q(value=eu.tag_value, project_id=eu.project_id)
            for eu in event_users
        ]
        try:
            group_id = GroupTagValue.objects.filter(
                reduce(or_, tag_filters),
                key='sentry:user',
            ).order_by('-last_seen').values_list('group_id', flat=True)[0]
        except IndexError:
            last_issue = None
        else:
            last_issue = Group.objects.get(id=group_id)

        return {
            'id': six.text_type(obj.id),
            'hash': obj.hash,
            'tagValue': obj.tag_value,
            'identifier': obj.ident,
            'username': obj.username,
            'email': obj.email,
            'name': obj.get_display_name(),
            'ipAddress': obj.ip_address,
            'dateCreated': obj.date_added,
            'avatarUrl': get_gravatar_url(obj.email, size=32),
            'lastLocation': serialize(last_location, user),
            'lastIssue': serialize(last_issue, user),
        }
