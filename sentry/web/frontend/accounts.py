"""
sentry.web.frontend.accounts
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.conf import settings as dj_settings
from django.core.context_processors import csrf
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.views.decorators.csrf import csrf_protect

from sentry.web.decorators import login_required
from sentry.web.forms import AccountSettingsForm
from sentry.web.helpers import render_to_response


@csrf_protect
def login(request):
    from django.contrib.auth import login as login_
    from django.contrib.auth.forms import AuthenticationForm

    form = AuthenticationForm(request, request.POST or None)
    if form.is_valid():
        login_(request, form.get_user())
        return HttpResponseRedirect(request.POST.get('next') or reverse('sentry'))
    else:
        request.session.set_test_cookie()

    context = csrf(request)
    context.update({
        'form': form,
    })
    return render_to_response('sentry/login.html', context, request)


def logout(request):
    from django.contrib.auth import logout

    logout(request)

    return HttpResponseRedirect(reverse('sentry'))


@csrf_protect
@login_required
def settings(request):
    form = AccountSettingsForm(request.user, request.POST or None, initial={
        'email': request.user.email,
        'first_name': request.user.first_name,
        'language': request.LANGUAGE_CODE,
    })
    if form.is_valid():
        form.save()
        response = HttpResponseRedirect(reverse('sentry-account-settings') + '?success=1')
        if hasattr(request, 'session'):
            request.session['django_language'] = form.cleaned_data['language']
        else:
            response.set_cookie(dj_settings.LANGUAGE_COOKIE_NAME, form.cleaned_data['language'])
        return response

    context = csrf(request)
    context.update({
        'form': form,
    })
    return render_to_response('sentry/account/settings.html', context, request)
