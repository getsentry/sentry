from __future__ import absolute_import

import json

from datetime import timedelta
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.assistant.guides import GUIDES
from sentry.models import AssistantActivity


VALID_STATUSES = frozenset(('viewed', 'dismissed', 'snoozed'))
VALID_SNOOZE_DURATION_HOURS = frozenset((1, 24, 24 * 7))


class AssistantEndpoint(Endpoint):
    permission_classes = (IsAuthenticated, )

    def get(self, request):
        """Return all the guides the user has not seen, dismissed, or snoozed."""
        # TODO(adhiraj): Uncomment after migration is done.
        # exclude = AssistantActivity.objects.filter(
        #     user=request.user,
        # ).exclude(
        #     snoozed_until_ts__lt=timezone.now(),
        # )
        # exclude_ids = set(e.id for e in exclude)
        exclude_ids = set()
        result = {k: v for k, v in GUIDES.items() if v['id'] not in exclude_ids}

        return Response(result)

    def put(self, request):
        """Mark a guide as having been viewed, dismissed, or snoozed.

        Request is of the form {
            'guide_id': <guide_id>,
            'status': 'viewed' / 'dismissed' / 'snoozed',
            'useful': true / false / null,
            'duration_hours': <if snoozed, for how many hours>,
        }
        """
        req = json.loads(request.body)
        guide_id = req['guide_id']
        status = req['status']
        duration_hours = req.get('duration_hours')
        useful = req.get('useful')

        guide_ids = set(v['id'] for v in GUIDES.values())
        if (guide_id not in guide_ids or
            status not in VALID_STATUSES or
            (status == 'snoozed' and duration_hours not in VALID_SNOOZE_DURATION_HOURS) or
                useful not in (None, True, False)):
            return Response(status=400)

        fields = {}
        if useful is not None:
            fields['useful'] = useful
        if status == 'viewed':
            fields['viewed_ts'] = timezone.now()
        elif status == 'dismissed':
            fields['dismissed_ts'] = timezone.now()
        else:
            fields['snoozed_until_ts'] = timezone.now() + timedelta(hours=duration_hours)

        AssistantActivity.objects.get_or_create(
            user=request.user, guide_id=guide_id, **fields
        )

        return HttpResponse(201)
