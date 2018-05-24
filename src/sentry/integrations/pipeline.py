from __future__ import absolute_import, print_function

__all__ = ['IntegrationPipeline']

from django.http import HttpResponse
from django.utils import timezone

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

        org_integration = integration.add_organization(self.organization.id)

        # Does this integration provide a user identity for the user setting up
        # the integration?
        identity = data.get('user_identity')
        identity_config = data.get('identity_config', {})

        if identity:
            # Create identity provider for this integration if necessary
            idp, created = IdentityProvider.objects.get_or_create(
                external_id=data['external_id'],
                organization_id=0,
                type=identity['type'],
                defaults={'config': identity_config},
            )
            if created:
                idp.update(config=identity_config)

            Identity.objects.get_or_create(
                idp=idp,
                user=self.request.user,
                external_id=identity['external_id'],
                defaults={
                    'status': IdentityStatus.VALID,
                    'scopes': identity['scopes'],
                    'data': identity['data'],
                    'date_verified': timezone.now(),
                },
            )

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
