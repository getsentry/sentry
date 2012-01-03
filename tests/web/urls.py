from django.conf.urls.defaults import *
from django.contrib import admin

admin.autodiscover()

from . import views

urlpatterns = patterns('',
    url(r'^admin/', include(admin.site.urls)),
    url(r'^fake-login$', views.fake_login, name='sentry-fake-login'),
    url(r'^trigger-500$', views.raise_exc, name='sentry-raise-exc'),
    url(r'^trigger-500-decorated$', views.decorated_raise_exc, name='sentry-raise-exc-decor'),
    url(r'^trigger-500-django$', views.django_exc, name='sentry-django-exc'),
    url(r'^trigger-500-template$', views.template_exc, name='sentry-template-exc'),
    url(r'^trigger-500-log-request$', views.logging_request_exc, name='sentry-log-request-exc'),
    url(r'', include('sentry.web.urls')),
)