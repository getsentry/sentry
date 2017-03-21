from __future__ import absolute_import, print_function

import six

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone
from django.utils.safestring import mark_safe
from django.views.decorators.cache import never_cache
from operator import or_
from six.moves import reduce
from six.moves.urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from sentry.models import (
    ApiApplication, ApiApplicationStatus, ApiAuthorization, ApiGrant, ApiToken
)
from sentry.web.frontend.base import BaseView


class OAuthAuthorizeView(BaseView):
    @never_cache
    def dispatch(self, request, *args, **kwargs):
        with transaction.atomic():
            return super(OAuthAuthorizeView, self).dispatch(
                request, *args, **kwargs)

    def redirect_response(self, response_type, redirect_uri, params):
        if response_type == 'token':
            return self.redirect('{}#{}'.format(
                redirect_uri, urlencode([
                    (k, v) for k, v in six.iteritems(params)
                    if v is not None
                ])
            ))

        parts = list(urlparse(redirect_uri))
        query = parse_qsl(parts[4])
        for key, value in six.iteritems(params):
            if value is not None:
                query.append((key, value))
        parts[4] = urlencode(query)
        return self.redirect(urlunparse(parts))

    def error(self, response_type, redirect_uri, name, state=None):
        return self.redirect_response(response_type, redirect_uri, {
            'error': name,
            'state': state,
        })

    def get(self, request):
        response_type = request.GET.get('response_type')
        client_id = request.GET.get('client_id')
        redirect_uri = request.GET.get('redirect_uri')
        scopes = request.GET.get('scope')
        state = request.GET.get('state')
        force_prompt = request.GET.get('force_prompt')

        if not client_id:
            return self.respond('sentry/oauth-error.html', {
                'error': mark_safe('Missing or invalid <em>client_id</em> parameter.'),
            })

        try:
            application = ApiApplication.objects.get(
                client_id=client_id,
                status=ApiApplicationStatus.active,
            )
        except ApiApplication.DoesNotExist:
            return self.respond('sentry/oauth-error.html', {
                'error': mark_safe('Missing or invalid <em>client_id</em> parameter.'),
            })

        if not redirect_uri:
            redirect_uri = application.get_default_redirect_uri()
        elif not application.is_valid_redirect_uri(redirect_uri):
            return self.respond('sentry/oauth-error.html', {
                'error': mark_safe('Missing or invalid <em>redirect_uri</em> parameter.'),
            })

        if not application.is_allowed_response_type(response_type):
            return self.error(
                response_type=response_type,
                redirect_uri=redirect_uri,
                name='unsupported_response_type',
                state=state,
            )

        if scopes:
            scopes = scopes.split(' ')
            for scope in scopes:
                if scope not in set(settings.SENTRY_SCOPES):
                    return self.error(
                        response_type=response_type,
                        redirect_uri=redirect_uri,
                        name='invalid_scope',
                        state=state,
                    )
        else:
            scopes = []

        if not force_prompt:
            try:
                existing_auth = ApiAuthorization.objects.get(
                    user=request.user,
                    application=application,
                )
            except ApiAuthorization.DoesNotExist:
                pass
            else:
                # if we've already approved all of the required scopes
                # we can skip prompting the user
                if all(getattr(existing_auth.scopes, s) for s in scopes):
                    return self.approve(
                        request=request,
                        application=application,
                        scopes=scopes,
                        response_type=response_type,
                        redirect_uri=redirect_uri,
                        state=state,
                    )

        payload = {
            'rt': response_type,
            'cid': client_id,
            'ru': redirect_uri,
            'sc': scopes,
            'st': state,
            'uid': request.user.id,
        }
        request.session['oa2'] = payload

        permissions = []
        if scopes:
            pending_scopes = set(scopes)
            matched_sets = set()
            for scope_set in settings.SENTRY_SCOPE_SETS:
                for scope, description in scope_set:
                    if scope_set in matched_sets:
                        pending_scopes.remove(scope)
                    elif scope in pending_scopes:
                        permissions.append(description)
                        matched_sets.add(scope_set)
                        pending_scopes.remove(scope)

            if pending_scopes:
                raise NotImplementedError('{} scopes did not have descriptions'.format(pending_scopes))

        context = {
            'user': request.user,
            'application': application,
            'scopes': scopes,
            'permissions': permissions,
        }
        return self.respond('sentry/oauth-authorize.html', context)

    def post(self, request):
        try:
            payload = request.session['oa2']
        except KeyError:
            return self.respond('sentry/oauth-error.html', {
                'error': 'We were unable to complete your request. Please re-initiate the authorization flow.',
            })

        if payload['uid'] != request.user.id:
            return self.respond('sentry/oauth-error.html', {
                'error': 'We were unable to complete your request. Please re-initiate the authorization flow.',
            })

        try:
            application = ApiApplication.objects.get(
                client_id=payload['cid'],
                status=ApiApplicationStatus.active,
            )
        except ApiApplication.DoesNotExist:
            return self.respond('sentry/oauth-error.html', {
                'error': mark_safe('Missing or invalid <em>client_id</em> parameter.'),
            })

        response_type = payload['rt']
        redirect_uri = payload['ru']
        scopes = payload['sc']

        op = request.POST.get('op')
        if op == 'approve':
            return self.approve(
                request=request,
                application=application,
                scopes=scopes,
                response_type=response_type,
                redirect_uri=redirect_uri,
                state=payload['st'],
            )

        elif op == 'deny':
            return self.error(
                response_type=response_type,
                redirect_uri=redirect_uri,
                name='access_denied',
                state=payload['st'],
            )
        else:
            raise NotImplementedError

    def approve(self, request, application, **params):
        try:
            with transaction.atomic():
                ApiAuthorization.objects.create(
                    application=application,
                    user=request.user,
                    scopes=(
                        reduce(or_, (
                            getattr(ApiAuthorization.scopes, k)
                            for k in params['scopes']
                        ))
                        if params['scopes']
                        else 0
                    ),
                )
        except IntegrityError:
            if params['scopes']:
                auth_scopes = F('scopes')
                for s in params['scopes']:
                    auth_scopes = auth_scopes.bitor(
                        getattr(ApiAuthorization.scopes, s)
                    )

                ApiAuthorization.objects.filter(
                    application=application,
                    user=request.user,
                ).update(
                    scopes=auth_scopes,
                )

        if params['response_type'] == 'code':
            grant = ApiGrant(
                user=request.user,
                application=application,
                redirect_uri=params['redirect_uri'],
            )
            if params['scopes']:
                for s in params['scopes']:
                    setattr(grant.scopes, s, True)
            grant.save()
            return self.redirect_response(
                params['response_type'],
                params['redirect_uri'],
                {
                    'code': grant.code,
                    'state': params['state'],
                },
            )
        elif params['response_type'] == 'token':
            token = ApiToken(
                application=application,
                user=request.user,
                refresh_token=None,
            )
            for s in params['scopes']:
                setattr(token.scopes, s, True)
            token.save()

            return self.redirect_response(
                params['response_type'],
                params['redirect_uri'],
                {
                    'access_token': token.token,
                    'expires_in': (timezone.now() - token.expires_at).total_seconds(),
                    'expires_at': token.expires_at.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
                    'token_type': 'bearer',
                    'scope': ' '.join(k for k, v in token.scopes.iteritems() if v),  # NOQA
                    'state': params['state'],
                },
            )
