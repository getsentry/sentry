import functools
from datetime import timedelta
from unittest.mock import Mock, call, patch
from uuid import uuid4

from dateutil.parser import parse as parse_datetime
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from freezegun import freeze_time
from rest_framework import status

from sentry import options
from sentry.issues.grouptype import PerformanceNPlusOneGroupType, PerformanceSlowDBQueryGroupType
from sentry.models import (
    GROUP_OWNER_TYPE,
    Activity,
    ApiToken,
    ExternalIssue,
    Group,
    GroupAssignee,
    GroupBookmark,
    GroupHash,
    GroupHistory,
    GroupInbox,
    GroupInboxReason,
    GroupLink,
    GroupOwner,
    GroupOwnerType,
    GroupResolution,
    GroupSeen,
    GroupShare,
    GroupSnooze,
    GroupStatus,
    GroupSubscription,
    GroupTombstone,
    Integration,
    OrganizationIntegration,
    Release,
    ReleaseStages,
    UserOption,
    add_group_to_inbox,
    remove_group_from_inbox,
)
from sentry.models.grouphistory import GroupHistoryStatus, record_group_history
from sentry.search.events.constants import (
    RELEASE_STAGE_ALIAS,
    SEMVER_ALIAS,
    SEMVER_BUILD_ALIAS,
    SEMVER_PACKAGE_ALIAS,
)
from sentry.silo import SiloMode
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers import parse_link_header
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.helpers.features import Feature, with_feature
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus
from sentry.utils import json


@region_silo_test(stable=True)
class OrganizationIssuesCountTest(APITestCase, SnubaTestCase):
    endpoint = "sentry-api-0-organization-issues-count"

    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1)

    def _parse_links(self, header):
        # links come in {url: {...attrs}}, but we need {rel: {...attrs}}
        links = {}
        for url, attrs in parse_link_header(header).items():
            links[attrs["rel"]] = attrs
            attrs["href"] = url
        return links

    def get_response(self, *args, **kwargs):
        if not args:
            org = self.project.organization.slug
        else:
            org = args[0]
        return super().get_response(org, **kwargs)

    @with_feature("organizations:global-views")
    def test_simple(self):
        event = self.store_event(
            data={"event_id": "a" * 32, "timestamp": iso_format(before_now(seconds=1))},
            project_id=self.project.id,
        )
        projects = [
            {"name": "web-beta", "slug": "web-beta"},
            {"name": "desktop-beta", "slug": "desktop-beta"},
        ]

        for project in projects:
            self.create_project(name=project["name"], slug=project["slug"])

        group = event.group
        self.login_as(user=self.user)

        response = self.get_success_response(
            query=["is:for_review assigned_or_suggested:[me, my_teams, none]"]
        )
        assert True
