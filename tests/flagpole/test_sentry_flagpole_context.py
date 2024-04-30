import pytest

from flagpole.sentry_flagpole_context import (
    InvalidContextDataException,
    get_sentry_flagpole_context_builder,
    organization_context_transformer,
    project_context_transformer,
    user_context_transformer,
)
from sentry.models.useremail import UserEmail
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


class TestSentryFlagpoleContext(TestCase):
    def test_sentry_flagpole_context_builder(self):
        org = self.create_organization()
        project = self.create_project(organization=org)
        sentry_flagpole_builder = get_sentry_flagpole_context_builder()

        sentry_context = sentry_flagpole_builder.build(dict(organization=org, project=project))

        assert sentry_context.get("organization_slug") == org.slug
        assert sentry_context.get("organization_slug") == org.slug
        assert sentry_context.get("project_slug") == project.slug
        assert sentry_context.get("project_id") == project.id


class TestSentryOrganizationContextTransformer(TestCase):
    def test_without_organization_passed(self):
        context_data = organization_context_transformer(dict())
        assert context_data == dict()

    def test_with_invalid_organization(self):
        with pytest.raises(InvalidContextDataException):
            organization_context_transformer(dict(organization=1234))

        with pytest.raises(InvalidContextDataException):
            organization_context_transformer(dict(organization=self.create_project()))

    def test_with_valid_organization(self):
        org = self.create_organization(slug="foobar", name="Foo Bar")
        org.flags.early_adopter = True
        org.save()
        assert bool(org.flags.early_adopter) is True

        context_data = organization_context_transformer(dict(organization=org))

        assert context_data == {
            "organization_slug": "foobar",
            "organization_id": org.id,
            "organization_name": "Foo Bar",
            "organization_is-early-adopter": True,
        }


class TestProjectContextTransformer(TestCase):
    def test_without_project_passed(self):
        context_data = project_context_transformer(dict())
        assert context_data == dict()

    def test_with_invalid_project_passed(self):
        with pytest.raises(InvalidContextDataException):
            project_context_transformer(dict(project=123))

        with pytest.raises(InvalidContextDataException):
            project_context_transformer(dict(project=self.create_organization()))

    def test_with_valid_project(self):
        project = self.create_project(slug="foobar", name="Foo Bar")

        context_data = project_context_transformer(dict(project=project))
        assert context_data == {
            "project_slug": "foobar",
            "project_name": "Foo Bar",
            "project_id": project.id,
        }


@control_silo_test
class TestUserContextTransformer(TestCase):
    def test_without_user_passed(self):
        context_data = project_context_transformer(dict())
        assert context_data == dict()

    def test_with_invalid_user_passed(self):
        with pytest.raises(InvalidContextDataException):
            user_context_transformer(dict(actor=123))

        with pytest.raises(InvalidContextDataException):
            user_context_transformer(dict(actor=self.create_organization()))

    def test_with_valid_user(self):
        user = self.create_user(email="foobar@example.com")
        # Create a new, unverified email to ensure we don't list it
        self.create_useremail(user=user, email="unverified_email@example.com")

        context_data = user_context_transformer(dict(actor=user))
        assert context_data == {
            "user_email": "foobar@example.com",
            "user_domain": "example.com",
            "user_id": user.id,
            "user_is-superuser": False,
            "user_is-staff": False,
        }

    def test_with_only_unverified_emails(self):
        user = self.create_user(email="foobar@example.com")
        user_email = UserEmail.objects.filter(user_id=user.id).get()
        user_email.is_verified = False
        user_email.save()

        context_data = user_context_transformer(dict(actor=user))
        assert context_data == {
            "user_id": user.id,
            "user_is-superuser": False,
            "user_is-staff": False,
        }

    def test_with_super_user_and_staff(self):
        user = self.create_user(email="super_user_admin_person@sentry.io", is_superuser=True)
        context_data = user_context_transformer(dict(actor=user))
        assert context_data == {
            "user_email": "super_user_admin_person@sentry.io",
            "user_domain": "sentry.io",
            "user_id": user.id,
            "user_is-superuser": True,
            "user_is-staff": False,
        }

        user.is_staff = True
        user.is_superuser = False
        user.save()
        context_data = user_context_transformer(dict(actor=user))
        assert context_data == {
            "user_email": "super_user_admin_person@sentry.io",
            "user_domain": "sentry.io",
            "user_id": user.id,
            "user_is-superuser": False,
            "user_is-staff": True,
        }


class TestTeamContextTransformer(TestCase):
    pass
    # def test_with_missing_team(self):
    #     context_data = team_context_transformer(dict())
    #     assert context_data == dict()
    #
    # def test_with_invalid_team(self):
    #     with pytest.raises(InvalidContextDataException):
    #         team_context_transformer(dict(team="invalid"))
    #
    #     with pytest.raises(InvalidContextDataException):
    #         team_context_transformer(dict(team=self.create_organization()))
    #
    # def test_with_valid_team(self):
    #     team = self.create_team(organization=self.create_organization())
    #
    #     context_data = team_context_transformer(dict(team=team))
    #     assert context_data == {
    #         "team_id": team.id
    #     }
