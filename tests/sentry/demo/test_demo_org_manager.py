from datetime import datetime

import pytest
import pytz
from django.db import IntegrityError
from django.test import override_settings

from sentry.demo.data_population import DataPopulation
from sentry.demo.demo_org_manager import assign_demo_org, create_demo_org
from sentry.demo.models import DemoOrganization, DemoOrgStatus, DemoUser
from sentry.demo.settings import DEMO_DATA_GEN_PARAMS
from sentry.models import (
    Organization,
    OrganizationMember,
    OrganizationStatus,
    Project,
    ProjectKey,
    Release,
    Team,
    User,
)
from sentry.testutils import TestCase
from sentry.utils.compat import mock
from sentry.utils.email import create_fake_email

org_owner_email = "james@example.com"
org_name = "Org Name"

DEMO_DATA_GEN_PARAMS = DEMO_DATA_GEN_PARAMS.copy()
DEMO_DATA_GEN_PARAMS["MAX_DAYS"] = 1
DEMO_DATA_GEN_PARAMS["SCALE_FACTOR"] = 0.05


@override_settings(
    DEMO_MODE=True, DEMO_ORG_OWNER_EMAIL=org_owner_email, DEMO_DATA_GEN_PARAMS=DEMO_DATA_GEN_PARAMS
)
class DemoOrgManagerTest(TestCase):
    @mock.patch.object(DataPopulation, "handle_react_python_scenario")
    @mock.patch.object(DataPopulation, "handle_mobile_scenario")
    @mock.patch("sentry.demo.demo_org_manager.generate_random_name", return_value=org_name)
    def test_create_demo_org(
        self,
        mock_generate_name,
        mock_handle_mobile_scenario,
        mock_handle_scenario,
    ):
        owner = User.objects.create(email=org_owner_email)

        create_demo_org()

        demo_org = DemoOrganization.objects.get(
            organization__name=org_name, status=DemoOrgStatus.PENDING
        )
        org = demo_org.organization

        assert OrganizationMember.objects.filter(
            user=owner, organization=org, role="owner"
        ).exists()

        assert len(Project.objects.filter(organization=org)) == 5
        assert len(Release.objects.filter(organization=org)) == 3
        mock_handle_scenario.assert_called_once_with(mock.ANY, mock.ANY)
        mock_handle_mobile_scenario.assert_called_once_with(mock.ANY, mock.ANY, mock.ANY)

    @mock.patch("sentry.demo.demo_org_manager.generate_random_name", return_value=org_name)
    @mock.patch.object(DataPopulation, "generate_releases")
    def test_no_owner(self, mock_generate_releases, mock_generate_name):
        with pytest.raises(User.DoesNotExist):
            create_demo_org()

        # verify we are using atomic transactions
        assert not Organization.objects.filter(name=org_name).exists()

    @mock.patch("django.utils.timezone.now")
    @mock.patch("sentry.demo.tasks.build_up_org_buffer.apply_async")
    def test_assign_demo_org(self, mock_build_up_org_buffer, mock_now):
        curr_time = datetime.utcnow().replace(tzinfo=pytz.utc)
        mock_now.return_value = curr_time

        org_slug = "some_org"
        org = self.create_organization(org_slug)
        DemoOrganization.objects.create(organization=org, status=DemoOrgStatus.PENDING)

        Team.objects.create(organization=org)

        project = self.create_project(organization=org)
        self.create_project_key(project)

        (org, user) = assign_demo_org()

        assert OrganizationMember.objects.filter(
            user=user, organization=org, role="member"
        ).exists()
        assert user.email == create_fake_email(org.slug, "demo")

        demo_org = DemoOrganization.objects.get(organization=org, status=DemoOrgStatus.ACTIVE)
        demo_user = DemoUser.objects.get(user=user)
        assert demo_org.date_assigned == curr_time
        assert demo_user.date_assigned == curr_time
        assert not ProjectKey.objects.filter(project__organization=org).exists()

        mock_build_up_org_buffer.assert_called_once_with()

    @mock.patch.object(DemoOrganization, "get_one_pending_org")
    @mock.patch.object(DemoUser, "create_user")
    @mock.patch("sentry.demo.tasks.build_up_org_buffer.apply_async")
    def test_assign_demo_org_integrity_error(
        self, mock_build_up_org_buffer, mock_create_user, mock_get_one_pending_org
    ):
        email = create_fake_email("slug-two", "demo")
        second_user = self.create_user(email=email)
        mock_create_user.side_effect = [IntegrityError, second_user]

        demo_orgs = []
        for org_slug in ["slug-one", "slug-two"]:
            org = self.create_organization(org_slug)
            demo_org = DemoOrganization.objects.create(
                organization=org, status=DemoOrgStatus.PENDING
            )
            demo_orgs.append(demo_org)
            Team.objects.create(organization=org)
            project = self.create_project(organization=org)
            self.create_project_key(project)

        # return the two orgs
        mock_get_one_pending_org.side_effect = demo_orgs

        # we should get the second org
        (org, user) = assign_demo_org()

        assert user.email == email
        assert org.slug == "slug-two"

        assert mock_create_user.call_count == 2
        assert mock_get_one_pending_org.call_count == 2

    @mock.patch.object(DemoUser, "create_user")
    @mock.patch("sentry.demo.tasks.build_up_org_buffer.apply_async")
    def test_assign_demo_org_integrity_error_retry_fails(
        self, mock_build_up_org_buffer, mock_create_user
    ):
        mock_create_user.side_effect = IntegrityError

        org = self.create_organization("some-slug")
        DemoOrganization.objects.create(organization=org, status=DemoOrgStatus.PENDING)
        Team.objects.create(organization=org)
        project = self.create_project(organization=org)
        self.create_project_key(project)

        with pytest.raises(IntegrityError):
            assign_demo_org()

        assert mock_create_user.call_count == 4

    @mock.patch.object(DataPopulation, "handle_react_python_scenario")
    @mock.patch.object(DataPopulation, "handle_mobile_scenario")
    @mock.patch.object(DataPopulation, "generate_releases")
    def test_no_org_ready(
        self, mock_generate_releases, mock_handle_mobile_scenario, mock_handle_python_react_scenario
    ):
        User.objects.create(email=org_owner_email)
        assign_demo_org()
        mock_handle_python_react_scenario.assert_called_once_with(mock.ANY, mock.ANY)

    @mock.patch("sentry.demo.demo_org_manager.delete_organization.apply_async")
    @mock.patch.object(DataPopulation, "handle_react_python_scenario")
    @mock.patch("sentry.demo.demo_org_manager.generate_random_name", return_value=org_name)
    @mock.patch.object(DataPopulation, "generate_releases")
    def test_data_population_fails(
        self,
        mock_generate_releases,
        mock_generate_name,
        mock_handle_scenario,
        mock_delete_organization,
    ):
        User.objects.create(email=org_owner_email)

        class HandleScenarioException(Exception):
            pass

        mock_handle_scenario.side_effect = HandleScenarioException("failure")
        with pytest.raises(HandleScenarioException):
            assign_demo_org()

        org = Organization.objects.get(name=org_name)
        assert org.status == OrganizationStatus.PENDING_DELETION

        mock_delete_organization.assert_called_once_with(kwargs={"object_id": org.id})
