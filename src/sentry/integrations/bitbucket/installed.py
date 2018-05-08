from __future__ import absolute_import


from django.db import IntegrityError, transaction
from django.views.decorators.csrf import csrf_exempt

from sentry.api.base import Endpoint
from sentry.models import Integration


class BitBucketInstalledEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    @csrf_exempt
    def dispatch(self, request, *args, **kwargs):
        return super(BitBucketInstalledEndpoint, self).dispatch(request, *args, **kwargs)

    def post(self, request, *args, **kwargs):
        data = request.DATA
        # TODO(jess): Handle updating existing integration
        try:
            with transaction.atomic():
                Integration.objects.create(
                    provider='bitbucket',
                    external_id=data['clientKey'],
                    name=data['baseUrl'],
                    metadata={
                        'oauth_client_id': data['oauthClientId'],
                        # public key is possibly deprecated, so we can maybe remove this
                        'public_key': data['publicKey'],
                        'shared_secret': data['sharedSecret'],
                        'base_url': data['baseUrl'],
                    }
                )
        except IntegrityError:
            pass

        return self.respond()
