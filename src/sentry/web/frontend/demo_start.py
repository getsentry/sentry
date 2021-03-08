import petname

from django.http import Http404
from django.conf import settings
from django.db import transaction
from django.template.defaultfilters import slugify

from sentry import roles
from sentry.demo.data_population import populate_python_project, populate_react_project
from sentry.models import (
    User,
    Organization,
    OrganizationMember,
    OrganizationMemberTeam,
    Project,
    ProjectKey,
)
from sentry.utils import auth
from sentry.utils.email import create_fake_email
from sentry.web.frontend.base import BaseView


def generate_random_name():
    return petname.Generate(2, " ", letters=10).title()


class DemoStartView(BaseView):
    csrf_protect = False
    auth_required = False

    @transaction.atomic
    def post(self, request):
        # need this check for tests since the route will exist even if DEMO_MODE=False
        if not settings.DEMO_MODE:
            raise Http404

        # TODO: add way to ensure we generate unique petnames
        name = generate_random_name()

        slug = slugify(name)

        email = create_fake_email(slug, "demo")
        user = User.objects.create(
            email=email,
            username=email,
            is_managed=True,
            flags=User.flags["demo_mode"],
        )

        org = Organization.objects.create(
            name=name,
            slug=slug,
            flags=Organization.flags["demo_mode"],
        )
        team = org.team_set.create(name=org.name)

        owner = User.objects.get(email=settings.DEMO_ORG_OWNER_EMAIL)
        OrganizationMember.objects.create(organization=org, user=owner, role=roles.get_top_dog().id)

        member = OrganizationMember.objects.create(organization=org, user=user, role="member")
        OrganizationMemberTeam.objects.create(team=team, organizationmember=member, is_active=True)

        python_project = Project.objects.create(name="Python", organization=org, platform="python")
        python_project.add_team(team)

        reat_project = Project.objects.create(
            name="React", organization=org, platform="javascript-react"
        )
        reat_project.add_team(team)

        populate_python_project(python_project)
        populate_react_project(reat_project)

        # delete all DSNs for the org so people don't send events
        ProjectKey.objects.filter(project__organization=org).delete()

        auth.login(request, user)

        resp = self.redirect(auth.get_login_redirect(request))
        # set a cookie of whether the user accepteed tracking so we know
        # whether to initialize analytics when accepted_tracking=1
        resp.set_cookie("accepted_tracking", request.POST.get("accepted_tracking"))

        return resp
