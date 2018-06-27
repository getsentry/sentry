from __future__ import absolute_import, print_function

__all__ = ['IntegrationPipeline']

import six

from django.db import IntegrityError
from django.http import HttpResponse
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from sentry.api.serializers import serialize
from sentry.models import Identity, IdentityProvider, IdentityStatus, Integration
from sentry.pipeline import Pipeline
from sentry.utils import json

from . import default_manager

DIALOG_RESPONSE = """
<!doctype html>
<html>
<body>
<script>
window.opener.postMessage({json}, document.origin);
window.close();
</script>
<noscript>Please wait...</noscript>
</body>
</html>
"""


def ensure_integration(key, data):
    defaults = {
        'metadata': data.get('metadata', {}),
        'name': data.get('name', data['external_id']),
    }
    integration, created = Integration.objects.get_or_create(
        provider=key,
        external_id=data['external_id'],
        defaults=defaults
    )
    if not created:
        integration.update(**defaults)

    return integration


class IntegrationPipeline(Pipeline):
    pipeline_name = 'integration_pipeline'
    provider_manager = default_manager

    def finish_pipeline(self):
        data = self.provider.build_integration(self.state.data)
        response = self._finish_pipeline(data)
        self.clear_session()
        return response

    def _finish_pipeline(self, data):
        if 'expect_exists' in data:
            integration = Integration.objects.get(
                provider=self.provider.key,
                external_id=data['external_id'],
            )
        else:
            integration = ensure_integration(self.provider.key, data)

        # Does this integration provide a user identity for the user setting up
        # the integration?
        identity = data.get('user_identity')

        if identity:
            # Some identity providers may not be directly associated to the
            # external integration. Integrations may specify the external_id to
            # be used for the idp.
            idp_external_id = data.get('idp_external_id', data['external_id'])
            idp_config = data.get('idp_config', {})

            # Create identity provider for this integration if necessary
            idp, created = IdentityProvider.objects.get_or_create(
                external_id=idp_external_id,
                type=identity['type'],
                defaults={'config': idp_config},
            )
            if not created:
                idp.update(config=idp_config)

            identity_data = {
                'status': IdentityStatus.VALID,
                'scopes': identity['scopes'],
                'data': identity['data'],
                'date_verified': timezone.now(),
            }

            try:
                identity_model, created = Identity.objects.get_or_create(
                    idp=idp,
                    user=self.request.user,
                    external_id=identity['external_id'],
                    defaults=identity_data,
                )

                if not created:
                    identity_model.update(**identity_data)
            except IntegrityError:
                # If the external_id is already used for a different user or
                # the user already has a different external_id remove those
                # identities and recreate it, except in the case of Github
                # where we need to be more careful because users may be using
                # those identities to log in.
                if idp.type == 'github':
                    try:
                        other_identity = Identity.objects.get(
                            idp=idp,
                            external_id=identity['external_id'],
                        )
                    except Identity.DoesNotExist:
                        # The user is linked to a different external_id. It's ok to relink
                        # here because they'll still be able to log in with the new external_id.
                        pass
                    else:
                        # The external_id is linked to a different user. If that user doesn't
                        # have a password, we don't delete the link as it may lock them out.
                        if not other_identity.user.has_usable_password():
                            return self._dialog_response({
                                # Force text_type conversion because translation objects are not
                                # JSON-serializable by default.
                                'error': six.text_type(_(
                                    'The provided Github account is linked to a different user. '
                                    'Please try again with a different Github account.'
                                ))},
                                False,
                            )
                identity_model = Identity.reattach(
                    idp, identity['external_id'], self.request.user, **identity_data)

        org_integration_args = {}

        if self.provider.needs_default_identity:
            if not (identity and identity_model):
                raise NotImplementedError('Integration requires an identity')
            org_integration_args = {'default_auth_id': identity_model.id}

        org_integration = integration.add_organization(self.organization.id, **org_integration_args)

        return self._dialog_response(serialize(org_integration, self.request.user), True)

    def _dialog_response(self, data, success):
        return HttpResponse(
            DIALOG_RESPONSE.format(
                json=json.dumps({
                    'success': success,
                    'data': data,
                })
            ),
            content_type='text/html',
        )
