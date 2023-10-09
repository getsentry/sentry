from typing import Any, Optional
from unittest import mock

from django.conf import settings

from sentry import features
from sentry.features.base import (
    Feature,
    FeatureHandlerStrategy,
    OrganizationFeature,
    ProjectFeature,
    SystemFeature,
    UserFeature,
)
from sentry.models.user import User
from sentry.testutils.cases import TestCase


class MockBatchHandler(features.BatchFeatureHandler):
    features = {"auth:register", "organizations:feature", "projects:feature"}

    def has(
        self,
        feature: Feature,
        actor: User,
        skip_entity: Optional[bool] = False,
    ) -> bool:
        return True

    def batch_has(self, feature_names, *args: Any, projects=None, organization=None, **kwargs: Any):
        if isinstance(feature_names, str):
            feature_names = [feature_names]

        feature_results = {
            feature_name: True for feature_name in feature_names if feature_name in self.features
        }

        if projects:
            return {f"project:{project.id}": feature_results for project in projects}

        if organization:
            return {f"organization:{organization.id}": feature_results}

        return {"unscoped": feature_results}

    def _check_for_batch(self, feature_name, organization, actor):
        return True if feature_name in self.features else None


class MockUserBatchHandler(features.BatchFeatureHandler):
    features = {"users:feature"}

    def _check_for_batch(self, feature_name, user, actor):
        return user.name == "steve"

    def batch_has(self, *a, **k):
        raise NotImplementedError("unreachable")


class FeatureManagerTest(TestCase):
    def test_feature_registry(self):
        manager = features.FeatureManager()
        assert manager.all() == {}

        manager.add("organizations:feature1", OrganizationFeature)
        manager.add("projects:feature2", ProjectFeature)
        manager.add("projects:feature3", ProjectFeature)
        assert set(manager.all(OrganizationFeature).keys()) == {"organizations:feature1"}
        assert set(manager.all(ProjectFeature).keys()) == {
            "projects:feature2",
            "projects:feature3",
        }

    def test_handlers(self):
        project_flag = "projects:test_handlers"
        test_user = self.create_user()

        class TestProjectHandler(features.FeatureHandler):
            features = {project_flag}

            def __init__(self, true_set, false_set):
                self.true_set = frozenset(true_set)
                self.false_set = frozenset(false_set)

            def has(self, feature, actor):
                assert actor == test_user

                if feature.project in self.true_set:
                    return True
                if feature.project in self.false_set:
                    return False
                return None

            def batch_has(self, *a, **k):
                raise NotImplementedError("unreachable")

        p1 = self.create_project()
        p2 = self.create_project()
        p3 = self.create_project()
        p4 = self.create_project()

        handlers = [
            TestProjectHandler([], []),
            TestProjectHandler([p1, p3], []),
            TestProjectHandler([], [p2, p3]),
        ]

        manager = features.FeatureManager()
        manager.add(project_flag, ProjectFeature)
        for handler in handlers:
            manager.add_handler(handler)

        assert manager.has(project_flag, p1, actor=test_user) is True
        assert manager.has(project_flag, p2, actor=test_user) is False
        assert manager.has(project_flag, p3, actor=test_user) is True
        assert manager.has(project_flag, p4, actor=test_user) is False

        assert manager.has_for_batch(
            project_flag, mock.sentinel.organization, [p1, p2, p3, p4], actor=test_user
        ) == {p1: True, p2: False, p3: True, p4: False}

    def test_entity_handler(self):
        test_org = self.create_organization()
        # Add a registered handler
        registered_handler = mock.Mock()
        registered_handler.features = ["organizations:feature1"]
        manager = features.FeatureManager()
        manager.add("organizations:feature1", OrganizationFeature)

        # Add the entity handler
        entity_handler = mock.Mock()
        manager.add("organizations:unregistered-feature", OrganizationFeature)

        # Non entity feature
        manager.add("organizations:settings-feature", OrganizationFeature)

        manager.add_handler(registered_handler)
        manager.add_entity_handler(entity_handler)

        # A feature with a registered handler shouldn't use the entity handler
        assert manager.has("organizations:feature1", test_org)
        assert len(entity_handler.has.mock_calls) == 0
        assert len(registered_handler.mock_calls) == 1

        # The feature isn't registered, so it should try checking the entity_handler
        assert manager.has("organizations:unregistered-feature", test_org)
        assert len(entity_handler.has.mock_calls) == 1
        assert len(registered_handler.mock_calls) == 1

        # The feature isn't registered, but lets skip the entity_handler
        manager.has("organizations:unregistered-feature", test_org, skip_entity=True)
        assert len(entity_handler.has.mock_calls) == 1
        assert len(registered_handler.mock_calls) == 1

        # The entity_handler doesn't have a response for this feature either, so settings should be checked instead
        entity_handler.has.return_value = None
        with mock.patch.dict(settings.SENTRY_FEATURES, {"organizations:settings-feature": "test"}):
            assert manager.has("organizations:settings-feature", test_org) == "test"
            assert len(entity_handler.mock_calls) == 2

    def test_has_for_batch(self):
        test_user = self.create_user()
        test_org = self.create_organization()

        projects = [self.create_project(organization=test_org) for i in range(5)]

        def create_handler(flags, result):
            class OrganizationTestHandler(features.BatchFeatureHandler):
                features = set(flags)

                def __init__(self):
                    self.hit_counter = 0

                def _check_for_batch(self, feature_name, organization, actor):
                    assert feature_name in self.features
                    assert organization == test_org
                    assert actor == test_user

                    self.hit_counter += 1
                    return result

                def batch_has(self, *a, **k):
                    raise NotImplementedError("unreachable")

            return OrganizationTestHandler()

        yes_flag = "organizations:yes"
        no_flag = "organizations:no"

        null_handler = create_handler([yes_flag, no_flag], None)
        yes_handler = create_handler([yes_flag], True)
        after_yes_handler = create_handler([yes_flag], False)
        no_handler = create_handler([no_flag], False)
        after_no_handler = create_handler([no_flag], True)

        manager = features.FeatureManager()
        for flag in (yes_flag, no_flag):
            manager.add(flag, OrganizationFeature)

        for handler in (null_handler, yes_handler, after_yes_handler, no_handler, after_no_handler):
            manager.add_handler(handler)

        assert manager.has_for_batch(yes_flag, test_org, projects, actor=test_user) == {
            p: True for p in projects
        }
        assert yes_handler.hit_counter == 1  # as opposed to len(projects)
        assert after_yes_handler.hit_counter == 0

        assert manager.has_for_batch(no_flag, test_org, projects, actor=test_user) == {
            p: False for p in projects
        }
        assert no_handler.hit_counter == 1
        assert after_no_handler.hit_counter == 0

        assert null_handler.hit_counter == 2

    def test_batch_has(self):
        manager = features.FeatureManager()
        manager.add("auth:register")
        manager.add("organizations:feature", OrganizationFeature)
        manager.add("projects:feature", ProjectFeature)
        manager.add_entity_handler(MockBatchHandler())

        ret = manager.batch_has(["auth:register"], actor=self.user)
        assert ret is not None
        assert ret["unscoped"]["auth:register"]
        ret = manager.batch_has(
            ["organizations:feature"], actor=self.user, organization=self.organization
        )
        assert ret is not None
        assert ret[f"organization:{self.organization.id}"]["organizations:feature"]
        ret = manager.batch_has(["projects:feature"], actor=self.user, projects=[self.project])
        assert ret is not None
        assert ret[f"project:{self.project.id}"]["projects:feature"]

    def test_batch_has_no_entity(self):
        manager = features.FeatureManager()
        manager.add("auth:register")
        manager.add("organizations:feature", OrganizationFeature)
        manager.add("projects:feature", ProjectFeature)
        manager.add_handler(MockBatchHandler())

        ret = manager.batch_has(["auth:register"], actor=self.user)
        assert ret is not None
        assert ret["unscoped"]["auth:register"]
        ret = manager.batch_has(
            ["organizations:feature"], actor=self.user, organization=self.organization
        )
        assert ret is not None
        assert ret[f"organization:{self.organization.id}"]["organizations:feature"]
        ret = manager.batch_has(["projects:feature"], actor=self.user, projects=[self.project])
        assert ret is not None
        assert ret[f"project:{self.project.id}"]["projects:feature"]

    def test_has(self):
        manager = features.FeatureManager()
        manager.add("auth:register")
        manager.add("organizations:feature", OrganizationFeature)
        manager.add("projects:feature", ProjectFeature)
        manager.add_handler(MockBatchHandler())

        assert manager.has("organizations:feature", actor=self.user, organization=self.organization)
        assert manager.has("projects:feature", actor=self.user, project=self.project)
        assert manager.has("auth:register", actor=self.user)

    def test_user_flag(self):
        manager = features.FeatureManager()
        manager.add("users:feature", UserFeature)
        manager.add_handler(MockUserBatchHandler())
        steve = self.create_user(name="steve")
        other_user = self.create_user(name="neo")
        assert manager.has("users:feature", steve, actor=steve)
        assert not manager.has("users:feature", other_user, actor=steve)
        with self.assertRaisesMessage(
            NotImplementedError, "User flags not allowed with entity_feature=True"
        ):
            manager.add("users:feature-2", UserFeature, True)

    def test_entity_feature_shim(self):
        manager = features.FeatureManager()

        manager.add("feat:1", OrganizationFeature)
        manager.add("feat:2", OrganizationFeature, False)
        manager.add("feat:3", OrganizationFeature, FeatureHandlerStrategy.INTERNAL)

        manager.add("feat:4", OrganizationFeature, True)
        manager.add("feat:5", OrganizationFeature, FeatureHandlerStrategy.REMOTE)

        assert "feat:1" not in manager.entity_features
        assert "feat:2" not in manager.entity_features
        assert "feat:3" not in manager.entity_features

        assert "feat:4" in manager.entity_features
        assert "feat:5" in manager.entity_features

    def test_all(self):
        manager = features.FeatureManager()

        manager.add("feat:org", OrganizationFeature)
        manager.add("feat:project", ProjectFeature, False)
        manager.add("feat:system", SystemFeature, False)

        assert list(manager.all().keys()) == ["feat:org", "feat:project", "feat:system"]
        assert list(manager.all(OrganizationFeature).keys()) == ["feat:org"]
