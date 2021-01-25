import logging

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.http import HttpResponse
from django.template import loader

from sentry.auth import access
from sentry.models import Team
from sentry.utils.auth import get_login_url  # NOQA: backwards compatibility

logger = logging.getLogger("sentry")


def get_default_context(request, existing_context=None, team=None):
    from sentry import options
    from sentry.plugins.base import plugins

    context = {
        "URL_PREFIX": options.get("system.url-prefix"),
        "SINGLE_ORGANIZATION": settings.SENTRY_SINGLE_ORGANIZATION,
        "PLUGINS": plugins,
        "ONPREMISE": settings.SENTRY_ONPREMISE,
    }

    if existing_context:
        if team is None and "team" in existing_context:
            team = existing_context["team"]

        if "project" in existing_context:
            project = existing_context["project"]
        else:
            project = None
    else:
        project = None

    if team:
        organization = team.organization
    elif project:
        organization = project.organization
    else:
        organization = None

    if request:
        if (not existing_context or "TEAM_LIST" not in existing_context) and team:
            context["TEAM_LIST"] = Team.objects.get_for_user(
                organization=team.organization, user=request.user, with_projects=True
            )

        user = request.user
    else:
        user = AnonymousUser()

    if not existing_context or "ACCESS" not in existing_context:
        if request:
            context["ACCESS"] = access.from_request(
                request=request, organization=organization
            ).to_django_context()
        else:
            context["ACCESS"] = access.from_user(
                user=user, organization=organization
            ).to_django_context()

    return context


def render_to_string(template, context=None, request=None):

    # HACK: set team session value for dashboard redirect
    if context and "team" in context and isinstance(context["team"], Team):
        team = context["team"]
    else:
        team = None

    default_context = get_default_context(request, context, team=team)

    if context is None:
        context = default_context
    else:
        context = dict(context)
        context.update(default_context)

    return loader.render_to_string(template, context=context, request=request)


def render_to_response(template, context=None, request=None, status=200, content_type="text/html"):
    response = HttpResponse(render_to_string(template, context, request))
    response.status_code = status
    response["Content-Type"] = content_type
    return response
