from __future__ import absolute_import

from datetime import timedelta
from django import forms
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.permissions import assert_perm
from sentry.api.serializers import serialize
from sentry.models import Group, Activity
from sentry.utils.functional import extract_lazy_object


class NewNoteForm(forms.Form):
    text = forms.CharField()


class GroupNotesEndpoint(Endpoint):
    def get(self, request, group_id):
        group = Group.objects.get(
            id=group_id,
        )

        assert_perm(group, request.user, request.auth)

        notes = Activity.objects.filter(
            group=group,
            type=Activity.NOTE,
        ).select_related('user')

        return self.paginate(
            request=request,
            queryset=notes,
            # TODO(dcramer): we want to sort by datetime
            order_by='-id',
            on_results=lambda x: serialize(x, request.user),
        )

    def post(self, request, group_id):
        group = Group.objects.get(
            id=group_id,
        )

        assert_perm(group, request.user, request.auth)

        form = NewNoteForm(request.DATA)
        if not form.is_valid():
            return Response('{"error": "form"}', status=status.HTTP_400_BAD_REQUEST)

        if Activity.objects.filter(
            group=group,
            type=Activity.NOTE,
            user=request.user,
            data=form.cleaned_data,
            datetime__gte=timezone.now() - timedelta(hours=1)
        ).exists():
            return Response('{"error": "duplicate"}', status=status.HTTP_400_BAD_REQUEST)

        activity = Activity.objects.create(
            group=group,
            project=group.project,
            type=Activity.NOTE,
            user=extract_lazy_object(request.user),
            data=form.cleaned_data,
        )

        # TODO: move this into the queue
        activity.send_notification()

        return Response(serialize(activity, request.user), status=201)
