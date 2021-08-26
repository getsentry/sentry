"""
sudo.views
~~~~~~~~~~

:copyright: (c) 2020 by Matt Robenolt.
:license: BSD, see LICENSE for more details.
"""
from urllib.parse import urlparse, urlunparse

from django.contrib.auth.decorators import login_required
from django.core.exceptions import ImproperlyConfigured
from django.http import HttpResponseRedirect, QueryDict
from django.shortcuts import resolve_url
from django.template.response import TemplateResponse
from django.utils.decorators import method_decorator
from django.utils.http import is_safe_url
from django.utils.module_loading import import_string
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.debug import sensitive_post_parameters
from django.views.generic import View

from sudo.forms import SudoForm
from sudo.settings import REDIRECT_FIELD_NAME, REDIRECT_TO_FIELD_NAME, REDIRECT_URL, URL
from sudo.utils import grant_sudo_privileges


class SudoView(View):
    """
    The default view for the sudo mode page. The role of this page is to
    prompt the user for their password again, and if successful, redirect
    them back to ``next``.
    """

    form_class = SudoForm
    template_name = "sudo/sudo.html"
    extra_context = None

    def handle_sudo(self, request, redirect_to, context):
        return request.method == "POST" and context["form"].is_valid()

    def grant_sudo_privileges(self, request, redirect_to):
        grant_sudo_privileges(request)
        # Restore the redirect destination from the GET request
        redirect_to = request.session.pop(REDIRECT_TO_FIELD_NAME, redirect_to)
        # Double check we're not redirecting to other sites
        if not is_safe_url(redirect_to, allowed_hosts=(request.get_host(),)):
            redirect_to = resolve_url(REDIRECT_URL)
        return HttpResponseRedirect(redirect_to)

    @method_decorator(sensitive_post_parameters())
    @method_decorator(never_cache)
    @method_decorator(csrf_protect)
    @method_decorator(login_required)
    def dispatch(self, request):
        redirect_to = request.GET.get(REDIRECT_FIELD_NAME, REDIRECT_URL)

        # Make sure we're not redirecting to other sites
        if not is_safe_url(redirect_to, allowed_hosts=(request.get_host(),)):
            redirect_to = resolve_url(REDIRECT_URL)

        if request.is_sudo():
            return HttpResponseRedirect(redirect_to)

        if request.method == "GET":
            request.session[REDIRECT_TO_FIELD_NAME] = redirect_to

        context = {
            "form": self.form_class(request.user, request.POST or None),
            "request": request,
            REDIRECT_FIELD_NAME: redirect_to,
        }
        if self.handle_sudo(request, redirect_to, context):
            return self.grant_sudo_privileges(request, redirect_to)
        if self.extra_context is not None:
            context.update(self.extra_context)
        return TemplateResponse(request, self.template_name, context)


def sudo(request, **kwargs):
    return SudoView(**kwargs).dispatch(request)


def redirect_to_sudo(next_url, sudo_url=None):
    """
    Redirects the user to the login page, passing the given 'next' page
    """
    if sudo_url is None:
        sudo_url = URL

    try:
        # django 1.10 and greater can't resolve the string 'sudo.views.sudo' to a URL
        # https://docs.djangoproject.com/en/1.10/releases/1.10/#removed-features-1-10
        sudo_url = import_string(sudo_url)
    except (ImportError, ImproperlyConfigured):
        pass  # wasn't a dotted path

    sudo_url_parts = list(urlparse(resolve_url(sudo_url)))

    querystring = QueryDict(sudo_url_parts[4], mutable=True)
    querystring[REDIRECT_FIELD_NAME] = next_url
    sudo_url_parts[4] = querystring.urlencode(safe="/")

    return HttpResponseRedirect(urlunparse(sudo_url_parts))
