from copy import copy

from django.conf.urls import include, url
from django.contrib import admin

from sentry.auth.superuser import is_active_superuser


class RestrictiveAdminSite(admin.AdminSite):
    def has_permission(self, request):
        return is_active_superuser(request)


def make_site():
    """
    Creates a restrictive admin site that only allows the models listed in the `models` argument.

    :param models: A list of model classes to be allowed
    access to the admin site.
    """
    admin.autodiscover()

    # now kill off autodiscover since it would reset the registry
    admin.autodiscover = lambda: None

    site = RestrictiveAdminSite()
    # copy over the autodiscovery
    site._registry = copy(admin.site._registry)

    # clear the default site registry to avoid leaking an insecure admin
    admin.site._registry = {}

    # rebind our admin site to maintain compatibility
    admin.site = site

    return site


site = make_site()

urlpatterns = [url(r"^admin/", include(site.urls[:2]))]
