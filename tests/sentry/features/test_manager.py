from __future__ import absolute_import

from django.conf import settings

from sentry import features
from sentry.utils.compat import mock
from sentry.testutils import TestCase


class FeatureManagerTest(TestCase):
    def test_feature_registry(self):
        manager = features.FeatureManager()
        assert manager.all() == {}

        manager.add("organizations:feature1", features.OrganizationFeature)
        manager.add("projects:feature2", features.ProjectFeature)
        manager.add("projects:feature3", features.ProjectFeature)
        assert set(manager.all(features.OrganizationFeature).keys()) == {"organizations:feature1"}
        assert set(manager.all(features.ProjectFeature).keys()) == {
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
        manager.add(project_flag, features.ProjectFeature)
        for handler in handlers:
            manager.add_handler(handler)

        assert manager.has(project_flag, p1, actor=test_user) is True
        assert manager.has(project_flag, p2, actor=test_user) is False
        assert manager.has(project_flag, p3, actor=test_user) is True
        assert manager.has(project_flag, p4, actor=test_user) is False

        organization = None  # Doesn't matter because no BatchFeatureHandlers
        assert manager.has_for_batch(
            project_flag, organization, [p1, p2, p3, p4], actor=test_user
        ) == {p1: True, p2: False, p3: True, p4: False}

    def test_entity_handler(self):
        test_org = self.create_organization()
        # Add a registered handler
        registered_handler = mock.Mock()
        registered_handler.features = ["organizations:feature1"]
        manager = features.FeatureManager()
        manager.add("organizations:feature1", features.OrganizationFeature)

        # Add the entity handler
        entity_handler = mock.Mock()
        manager.add("organizations:unregistered-feature", features.OrganizationFeature)

        # Non entity feature
        manager.add("organizations:settings-feature", features.OrganizationFeature)

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

        # The entity_handler doesn't have a response for this feature either, so settings should be checked instead
        entity_handler.has.return_value = None
        settings.SENTRY_FEATURES["organizations:settings-feature"] = "test"
        assert manager.has("organizations:settings-feature", test_org) == "test"
        assert len(entity_handler.mock_calls) == 2

    def test_has_for_batch(self):
        test_user = self.create_user()
        test_org = self.create_organization()

        projects = [self.create_project(organization=test_org) for i in range(5)]

        def create_handler(flags, result):
            class OrganizationTestHandler(features.BatchFeatureHandler):
                features = frozenset(flags)

                def __init__(self):
                    self.hit_counter = 0

                def _check_for_batch(self, feature_name, organization, actor):
                    assert feature_name in self.features
                    assert organization == test_org
                    assert actor == test_user

                    self.hit_counter += 1
                    return result

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
            manager.add(flag, features.OrganizationFeature)

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
