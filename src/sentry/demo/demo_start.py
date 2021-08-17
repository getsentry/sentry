import logging
from typing import Optional
from urllib.parse import quote

import sentry_sdk
from django.conf import settings
from django.http import Http404
from sentry_sdk import capture_exception

from sentry.discover.models import DiscoverSavedQuery
from sentry.models import (
    Group,
    Organization,
    OrganizationMember,
    OrganizationStatus,
    Project,
    Release,
)
from sentry.snuba import discover
from sentry.utils import auth
from sentry.web.decorators import transaction_start
from sentry.web.frontend.base import BaseView

logger = logging.getLogger(__name__)

ACCEPTED_TRACKING_COOKIE = "accepted_tracking"
MEMBER_ID_COOKIE = "demo_member_id"
SKIP_EMAIL_COOKIE = "skip_email"
SAAS_ORG_SLUG = "saas_org_slug"
EXTRA_QUERY_STRING = "extra_query_string"


class DemoStartView(BaseView):
    csrf_protect = False
    auth_required = False

    @transaction_start("DemoStartView")
    def post(self, request):
        # double check DEMO_MODE is disabled
        if not settings.DEMO_MODE:
            raise Http404

        org = None
        # see if the user already was assigned a member
        member_id = request.get_signed_cookie(MEMBER_ID_COOKIE, default="")
        logger.info("post.start", extra={"cookie_member_id": member_id})
        sentry_sdk.set_tag("member_id", member_id)

        skip_buffer_input = request.POST.get("skipBuffer")
        skip_buffer = skip_buffer_input == "1"
        sentry_sdk.set_tag("skip_buffer", skip_buffer)

        scenario = request.POST.get("scenario")
        sentry_sdk.set_tag("scenario", scenario)

        if member_id and not skip_buffer:
            try:
                # only assign them to an active org for a member role
                member = OrganizationMember.objects.get(
                    id=member_id, organization__status=OrganizationStatus.ACTIVE, role="member"
                )
            except OrganizationMember.DoesNotExist:
                pass
            else:
                org = member.organization
                user = member.user
                logger.info("post.retrieved_user", extra={"organization_slug": org.slug})

        if not org:
            # move this import here so we Django doesn't discover the models
            # for demo mode except when Demo mode is actually active
            from .demo_org_manager import assign_demo_org

            # assign the demo org and get the user
            org, user = assign_demo_org(skip_buffer=skip_buffer)
            member = OrganizationMember.objects.get(organization=org, user=user)

            logger.info("post.assigned_org", extra={"organization_slug": org.slug})

        auth.login(request, user)

        extra_query_string = request.POST.get("extraQueryString")
        redirect_url = get_redirect_url(request, org)

        if extra_query_string:
            hash_param = ""

            if "#" in redirect_url:
                partition = redirect_url.index("#")
                hash_param = redirect_url[partition:]
                redirect_url = redirect_url[:partition]

            separator = "&" if "?" in redirect_url else "?"
            redirect_url += separator + extra_query_string + hash_param
        resp = self.redirect(redirect_url)

        # set a cookie of whether the user accepted tracking so we know
        # whether to initialize analytics when accepted_tracking=1
        # 0 means don't show the footer to accept cookies (user already declined)
        # no value means we show the footer to accept cookies (user has neither accepted nor declined)
        # TODO: remove snake case
        accepted_tracking = request.POST.get("acceptedTracking")
        if accepted_tracking in ["0", "1"]:
            resp.set_cookie(ACCEPTED_TRACKING_COOKIE, accepted_tracking)

        # if skip email is 1, set the cookie
        skip_email = request.POST.get("skipEmail")
        if skip_email == "1":
            resp.set_cookie(SKIP_EMAIL_COOKIE, skip_email)

        saas_org_slug = request.POST.get("saasOrgSlug")
        if saas_org_slug:
            resp.set_cookie(SAAS_ORG_SLUG, saas_org_slug)

        if extra_query_string:
            resp.set_cookie(EXTRA_QUERY_STRING, extra_query_string)

        # set the member id
        resp.set_signed_cookie(MEMBER_ID_COOKIE, member.id)
        return resp


def get_redirect_url(request, org):
    # determine the redirect based on the scenario
    scenario = request.POST.get("scenario")
    # basic scenarios
    if scenario == "performance":
        return f"/organizations/{org.slug}/performance/"
    if scenario == "releases":
        return f"/organizations/{org.slug}/releases/"
    if scenario == "alerts":
        return f"/organizations/{org.slug}/alerts/"
    if scenario == "discover":
        return f"/organizations/{org.slug}/discover/queries/"
    if scenario == "dashboards":
        return f"/organizations/{org.slug}/dashboards/"
    if scenario == "projects":
        return f"/organizations/{org.slug}/projects/"

    # more complicated scenarios with query lookups
    try:
        # no project slug
        if scenario == "oneDiscoverQuery":
            return get_one_discover_query(org)

        # with project slug
        project_slug = request.POST.get("projectSlug")

        error_type = request.POST.get("errorType")

        # issue details
        if scenario == "oneIssue":
            return get_one_issue(org, project_slug, error_type)
        if scenario == "oneBreadcrumb":
            return get_one_breadcrumb(org, project_slug, error_type)
        if scenario == "oneStackTrace":
            return get_one_stack_trace(org, project_slug, error_type)

        # performance and discover
        if scenario == "oneTransaction":
            return get_one_transaction(org, project_slug)
        if scenario == "oneWebVitals":
            return get_one_web_vitals(org, project_slug)
        if scenario == "oneTransactionSummary":
            return get_one_transaction_summary(org, project_slug)

        # releases
        if scenario == "oneRelease":
            return get_one_release(org, project_slug)

    except Exception:
        # if an error happens and just let the user enter the sandbox
        # on the default page
        capture_exception()

    # default is the issues page
    return f"/organizations/{org.slug}/issues/"


def get_one_release(org: Organization, project_slug: Optional[str]):
    project = _get_project(org, project_slug)
    release_query = Release.objects.filter(organization=org)
    if project_slug:
        release_query = release_query.filter(projects=project)
    # pick the most recent release
    release = release_query.order_by("-date_added").first()
    version = quote(release.version)

    return f"/organizations/{org.slug}/releases/{version}/?project={project.id}"


def get_one_issue(org: Organization, project_slug: Optional[str], error_type: Optional[str]):
    group_query = Group.objects.filter(project__organization=org)
    if error_type:
        error_type = error_type.lower()
    similar_groups = []
    if project_slug:
        group_query = group_query.filter(project__slug=project_slug)
        if error_type:
            similar_groups = [
                group for group in group_query if check_strings_similar(error_type, group)
            ]
        if similar_groups:
            group = similar_groups[0]
        else:
            group = group_query.first()
    else:
        group = group_query.first()
    return f"/organizations/{org.slug}/issues/{group.id}/?project={group.project_id}"


def get_one_breadcrumb(org: Organization, project_slug: Optional[str], error_type: Optional[str]):
    return get_one_issue(org, project_slug, error_type) + "#breadcrumbs"


def get_one_stack_trace(org: Organization, project_slug: Optional[str], error_type: Optional[str]):
    return get_one_issue(org, project_slug, error_type) + "#exception"


def get_one_transaction(org: Organization, project_slug: Optional[str]):
    project = _get_project(org, project_slug)

    # find the most recent transaction
    result = discover.query(
        query="event.type:transaction",
        orderby="-timestamp",
        selected_columns=["id", "timestamp"],
        limit=1,
        params={
            "organization_id": org.id,
            "project_id": [project.id],
        },
        referrer="sandbox.demo_start.get_one_transaction",
    )

    transaction_id = result["data"][0]["id"]

    return f"/organizations/{org.slug}/performance/{project.slug}:{transaction_id}/"


def get_one_discover_query(org: Organization):
    discover_query = DiscoverSavedQuery.objects.filter(organization=org).first()

    return f"/organizations/{org.slug}/discover/results/?id={discover_query.id}&statsPeriod=7d"


def get_one_web_vitals(org: Organization, project_slug: Optional[str]):
    # project_slug should be specified so we always get a front end project
    project = _get_project(org, project_slug)
    transaction = _get_one_transaction_name(project)

    return f"/organizations/{org.slug}/performance/summary/vitals/?project={project.id}&statsPeriod=7d&transaction={transaction}"


def get_one_transaction_summary(org: Organization, project_slug: Optional[str]):
    project = _get_project(org, project_slug)
    transaction = _get_one_transaction_name(project)

    return f"/organizations/{org.slug}/performance/summary/?project={project.id}&statsPeriod=7d&transaction={transaction}"


def _get_project(org: Organization, project_slug: Optional[str]):
    project_query = Project.objects.filter(organization=org)
    if project_slug:
        project_query = project_query.filter(slug=project_slug)
    return project_query.first()


def _get_one_transaction_name(project: Project):
    result = discover.query(
        query="event.type:transaction",
        selected_columns=["transaction"],
        limit=1,
        params={
            "organization_id": project.organization_id,
            "project_id": [project.id],
        },
        referrer="sandbox.demo_start._get_one_transaction_name",
    )
    return result["data"][0]["transaction"]


def check_strings_similar(error_type, group):
    type = group.data["metadata"].get("type")
    title = group.data["metadata"].get("title")
    if type:
        if error_type in type.lower():
            return True
    if title:
        if error_type in title.lower():
            return True
    return False
