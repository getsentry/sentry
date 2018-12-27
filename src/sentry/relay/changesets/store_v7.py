from __future__ import absolute_import

from django.core.urlresolvers import resolve, reverse
from rest_framework.test import APIRequestFactory
from rest_framework import serializers
import six

from sentry.models import Project
from sentry.relay.changesets.base import BaseChangeset, ChangesetError


class StoreV7Serializer(serializers.Serializer):
    project_id = serializers.IntegerField(required=True)


class StoreV7(BaseChangeset):

    def preprocess(self, changeset):
        serializer = StoreV7Serializer(data=changeset)
        if not serializer.is_valid():
            raise ChangesetError(str(serializer.errors).splitlines()[0])

        data = changeset.get('data')
        if not data:
            raise ChangesetError('Missing data payload')

        self.event = data.get('event')
        if not self.event:
            raise ChangesetError('Missing event payload')

        self.public_key = data.get('public_key')
        if not self.public_key:
            raise ChangesetError('Missing public key')

        result = serializer.object

        try:
            Project.objects.filter(
                id=result.get('project_id'),
            ).get()
        except Project.DoesNotExist:
            raise ChangesetError('Project does not exist')

        self.project_id = result.get('project_id')

    def execute(self):
        auth = {
            'sentry_client': 'sentry-relay',
            'sentry_version': '7',
            'sentry_key': self.public_key,
        }

        # TODO(ja): Refactor StoreView and use internal APIs instead
        factory = APIRequestFactory()

        header = 'Sentry %s' % ', '.join('%s=%s' % (k, v) for k, v in six.iteritems(auth))
        path = reverse('sentry-api-store', kwargs={'project_id': self.project_id})
        request = factory.post(path, self.event, HTTP_X_SENTRY_AUTH=header)
        request.__from_api_client__ = True

        func, args, kwargs = resolve(path)
        func(request, *args, **kwargs)
