from __future__ import absolute_import

from django.core.urlresolvers import resolve, reverse
from rest_framework.test import APIRequestFactory
import six

from sentry.relay.change_set import ChangesetError


def execute(relay, project_id, changeset):
    if not project_id:
        raise ChangesetError('Missing project_id')

    event = changeset.get('event')
    if not event:
        raise ChangesetError('Missing event payload')

    public_key = changeset.get('public_key')
    if not event:
        raise ChangesetError('Missing public key')

    auth = {
        'sentry_client': 'sentry-relay',
        'sentry_version': '7',
        'sentry_key': public_key,
    }

    # TODO(ja): Refactor StoreView and use internal APIs instead
    factory = APIRequestFactory()

    header = 'Sentry %s' % ', '.join('%s=%s' % (k, v) for k, v in six.iteritems(auth))
    path = reverse('sentry-api-store', kwargs={'project_id': project_id})
    request = factory.post(path, event, HTTP_X_SENTRY_AUTH=header)
    request.__from_api_client__ = True

    func, args, kwargs = resolve(path)
    func(request, *args, **kwargs)
