from __future__ import absolute_import, print_function

__all__ = ['PipelineHelper']

import json
import logging

from django.db import IntegrityError, transaction
from django.http import HttpResponse

from sentry.api.serializers import serialize
from sentry.models import (
    Identity, IdentityProvider, IdentityStatus, Integration, Organization,
    UserIdentity
)
from sentry.utils.hashlib import md5_text
from sentry.utils.http import absolute_uri
from sentry.web.helpers import render_to_response

from . import default_manager

SESSION_KEY = 'integration.setup'

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

logger = logging.getLogger('sentry.integrations')


class PipelineHelper(object):
    logger = logger

    @classmethod
    def get_for_request(cls, request, provider_id):
        session = request.session.get(SESSION_KEY, {})
        if not session:
            logger.error('integrations.setup.missing-session-data')
            return None

        # TODO(dcramer): enforce access check
        organization = Organization.objects.get(
            id=session['org'],
        )

        if session.get('int'):
            integration = Integration.objects.get(
                id=session['int'],
                organization_id=organization.id,
            )
        else:
            integration = None

        if provider_id != session['pro']:
            logger.error('integrations.setup.invalid-provider')
            return None

        if session['uid'] != request.user.id:
            logger.error('integrations.setup.invalid-uid')
            return None

        instance = cls(
            request=request,
            organization=organization,
            integration=integration,
            provider_id=provider_id,
            step=session['step'],
            dialog=bool(session['dlg']),
            state=session['state'],
        )
        if instance.signature != session['sig']:
            logger.error('integrations.setup.invalid-signature')
            return None
        return instance

    @classmethod
    def initialize(cls, request, organization, provider_id, dialog=False):
        inst = cls(
            request=request,
            organization=organization,
            provider_id=provider_id,
            dialog=dialog,
        )
        inst.save_session()
        return inst

    def __init__(self, request, organization, provider_id, integration=None,
                 step=0, state=None, dialog=False):
        self.request = request
        self.integration = integration
        self.organization = organization
        self.provider = default_manager.get(provider_id)
        self.pipeline = self.provider.get_pipeline()
        self.signature = md5_text(*[
            '{module}.{name}'.format(
                module=type(v).__module__,
                name=type(v).__name__,
            ) for v in self.pipeline
        ]).hexdigest()
        self.step = step
        self.state = state or {}
        self.dialog = dialog

    def save_session(self):
        self.request.session[SESSION_KEY] = {
            'uid': self.request.user.id,
            'org': self.organization.id,
            'pro': self.provider.id,
            'int': self.integration.id if self.integration else '',
            'sig': self.signature,
            'step': self.step,
            'state': self.state,
            'dlg': int(self.dialog),
        }
        self.request.session.modified = True

    def get_redirect_url(self):
        return absolute_uri('/extensions/{}/setup/'.format(
            self.provider.id,
        ))

    def clear_session(self):
        if SESSION_KEY in self.request.session:
            del self.request.session[SESSION_KEY]
            self.request.session.modified = True

    def current_step(self):
        """
        Render the current step.
        """
        if self.step == len(self.pipeline):
            return self.finish_pipeline()
        return self.pipeline[self.step].dispatch(
            request=self.request,
            helper=self,
        )

    def next_step(self):
        """
        Render the next step.
        """
        self.step += 1
        self.save_session()
        return self.current_step()

    def finish_pipeline(self):
        data = self.provider.build_integration(self.state)
        response = self._finish_pipeline(data)
        self.clear_session()
        return response

    def respond(self, template, context=None, status=200):
        default_context = {
            'organization': self.organization,
            'provider': self.provider,
        }
        if context:
            default_context.update(context)

        return render_to_response(template, default_context, self.request, status=status)

    def error(self, message):
        # TODO(dcramer): this needs to handle the dialog
        self.clear_session()
        return self._dialog_response({'detail': message}, False)

    def bind_state(self, key, value):
        self.state[key] = value
        self.save_session()

    def fetch_state(self, key):
        return self.state.get(key)

    def _finish_pipeline(self, data):
        if self.integration:
            assert data['external_id'] == self.integration.external_id
            self.integration.update(
                metadata=data.get('metadata', {}),
                name=data.get('name', self.provider.name),
            )
        else:
            defaults = {
                'metadata': data.get('metadata', {}),
                'name': data.get('name', data['external_id']),
            }
            self.integration, created = Integration.objects.get_or_create(
                provider=self.provider.id,
                external_id=data['external_id'],
                defaults=defaults
            )
            if not created:
                self.integration.update(**defaults)
            self.integration.add_organization(self.organization.id)

        id_config = data.get('identity')
        if id_config:
            idp = IdentityProvider.get(id_config['type'], id_config['instance'])
            identity, created = Identity.objects.get_or_create(
                idp=idp,
                external_id=id_config['external_id'],
                defaults={
                    'status': IdentityStatus.VALID,
                    'scopes': id_config['scopes'],
                    'data': id_config['data'],
                },
            )
            if not created:
                if identity.status != IdentityStatus.VALID:
                    identity.update(status=IdentityStatus.VALID)
            try:
                with transaction.atomic():
                    UserIdentity.objects.create(
                        user=self.request.user,
                        identity=identity,
                    )
            except IntegrityError:
                pass

        return self._dialog_response(serialize(self.integration, self.request.user), True)

    def _dialog_response(self, data, success):
        assert self.dialog
        return HttpResponse(
            DIALOG_RESPONSE.format(
                json=json.dumps({
                    'success': success,
                    'data': data,
                })
            ),
            content_type='text/html',
        )
