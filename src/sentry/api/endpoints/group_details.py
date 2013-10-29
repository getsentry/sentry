from django.utils import timezone
from django.utils.decorators import method_decorator
from django.utils.translation import ugettext_lazy as _

from sentry.api.base import BaseView
from sentry.constants import STATUS_RESOLVED, STATUS_MUTED, STATUS_UNRESOLVED
from sentry.models import Group, Activity
from sentry.web.decorators import has_access
from sentry.utils.javascript import transform

from rest_framework import serializers, status
from rest_framework.response import Response


class StatusField(serializers.WritableField):
    choices = {
        'resolved': STATUS_RESOLVED,
        'unresolved': STATUS_UNRESOLVED,
        'muted': STATUS_MUTED,
    }
    default_error_messages = {
        'invalid_choice': _('Select a valid choice. %(value)s is not one of '
                            'the available choices.'),
    }

    _rev_choice_map = dict((v, k) for k, v in choices.iteritems())

    def validate(self, value):
        """
        Validates that the input is in self.choices.
        """
        super(StatusField, self).validate(value)
        if value and value not in self._rev_choice_map:
            raise serializers.ValidationError(
                self.error_messages['invalid_choice'] % {'value': value})

    def to_native(self, value):
        return self._rev_choice_map[value]

    def from_native(self, value):
        return self.choices[value]


class GroupSerializer(serializers.ModelSerializer):
    status = StatusField()

    class Meta:
        model = Group
        fields = ('id', 'status', 'times_seen', 'last_seen', 'first_seen', 'resolved_at', 'active_at')
        read_only_fields = ('id', 'times_seen', 'last_seen', 'first_seen', 'resolved_at', 'active_at')


class GroupDetailsView(BaseView):
    @method_decorator(has_access)
    def get(self, request, team, project, group_id):
        group = Group.objects.get(
            id=group_id,
            project=project,
        )
        serializer = GroupSerializer(group)

        return Response(serializer.data)

    @method_decorator(has_access)
    def put(self, request, team, project, group_id):
        group = Group.objects.get(
            id=group_id,
            project=project,
        )

        serializer = GroupSerializer(group, data=request.DATA)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        now = timezone.now()

        # It's important that we ensure state changes are atomic and that we
        # dont create multiple activity transactions
        if request.DATA.get('status') == 'resolved':
            group.resolved_at = now

            happened = Group.objects.filter(
                id=group.id,
            ).exclude(status=STATUS_RESOLVED).update(
                status=STATUS_RESOLVED,
                resolved_at=now,
            )

            if happened:
                Activity.objects.create(
                    project=project,
                    group=group,
                    type=Activity.SET_RESOLVED,
                    user=request.user,
                )

        serializer.save()

        return Response(transform(group, request))
