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
    })
    if form.is_valid():
        user = form.save()
        return HttpResponseRedirect(reverse('sentry-account-settings') + '?success=1')

    context = csrf(request)
    context.update({
        'form': form,
    })
    return render_to_response('sentry/account/settings.html', context, request)
