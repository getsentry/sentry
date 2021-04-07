from django.db.models import F

from sentry import roles
from sentry.api.endpoints.setup_wizard import SETUP_WIZARD_CACHE_KEY, SETUP_WIZARD_CACHE_TIMEOUT
from sentry.api.serializers import serialize
from sentry.cache import default_cache
from sentry.models import (
    ApiToken,
    Organization,
    OrganizationStatus,
    Project,
    ProjectKey,
    ProjectKeyStatus,
    ProjectStatus,
)
from sentry.web.frontend.base import BaseView
from sentry.web.helpers import render_to_response


class SetupWizardView(BaseView):
    def get(self, request, wizard_hash):
        """
        This opens a page where with an active session fill stuff into the cache
        Redirects to organization whenever cache has been deleted
        """
        context = {"hash": wizard_hash}
        key = f"{SETUP_WIZARD_CACHE_KEY}{wizard_hash}"

        wizard_data = default_cache.get(key)
        if wizard_data is None:
            return self.redirect_to_org(request)

        orgs = Organization.objects.filter(
            member_set__role__in=[x.id for x in roles.with_scope("org:read")],
            member_set__user=request.user,
            status=OrganizationStatus.VISIBLE,
        ).order_by("-date_added")[:50]

        filled_projects = []

        for org in orgs:
            projects = list(
                Project.objects.filter(organization=org, status=ProjectStatus.VISIBLE).order_by(
                    "-date_added"
                )[:50]
            )
            for project in projects:
                enriched_project = serialize(project)
                enriched_project["organization"] = serialize(org)
                keys = list(
                    ProjectKey.objects.filter(
                        project=project,
                        roles=F("roles").bitor(ProjectKey.roles.store),
                        status=ProjectKeyStatus.ACTIVE,
                    )
                )
                enriched_project["keys"] = serialize(keys)
                filled_projects.append(enriched_project)

        # Fetching or creating a token
        token = None
        tokens = [
            x
            for x in ApiToken.objects.filter(user=request.user).all()
            if "project:releases" in x.get_scopes()
        ]
        if not tokens:
            token = ApiToken.objects.create(
                user=request.user,
                scope_list=["project:releases"],
                refresh_token=None,
                expires_at=None,
            )
        else:
            token = tokens[0]

        result = {"apiKeys": serialize(token), "projects": filled_projects}

        key = f"{SETUP_WIZARD_CACHE_KEY}{wizard_hash}"
        default_cache.set(key, result, SETUP_WIZARD_CACHE_TIMEOUT)

        return render_to_response("sentry/setup-wizard.html", context, request)
