from django.conf import settings

if not settings.configured:
    from sentry.runner import configure

    configure(skip_service_validation=True)  # TODO: check if we need to do a service validation?


settings.ROOT_URLCONF = "apigw_django.urls"
settings.MIDDLEWARE = ()

from django.core.handlers.asgi import ASGIHandler

application = ASGIHandler()
