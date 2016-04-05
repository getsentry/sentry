from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.api.serializers import Serializer, register
from sentry.models import ProjectKey
from sentry.utils.http import absolute_uri


@register(ProjectKey)
class ProjectKeySerializer(Serializer):
    def serialize(self, obj, attrs, user):
        d = {
            'id': obj.public_key,
            'label': obj.label,
            'public': obj.public_key,
            'secret': obj.secret_key,
            'dsn': {
                'secret': obj.dsn_private,
                'public': obj.dsn_public,
                'csp': '{}?sentry_key={}'.format(
                    absolute_uri(reverse('sentry-api-csp-report', args=[
                        obj.project_id,
                    ])),
                    obj.public_key,
                ),
            },
            'dateCreated': obj.date_added,
        }
        return d
