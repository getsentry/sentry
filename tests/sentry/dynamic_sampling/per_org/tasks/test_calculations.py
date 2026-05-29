from __future__ import annotations

from unittest.mock import Mock, patch

import pytest

from sentry.dynamic_sampling.models.common import RebalancedItem
from sentry.dynamic_sampling.models.projects_rebalancing import ProjectsRebalancingInput
from sentry.dynamic_sampling.per_org.tasks.calculations import (
    compare_rebalanced_projects_with_cache,
    get_cached_rebalanced_project_sample_rates,
    is_within_relative_tolerance,
    run_project_balancing,
)
from sentry.dynamic_sampling.per_org.tasks.queries import ProjectVolume
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.dynamic_sampling.tasks.helpers.boost_low_volume_projects import (
    generate_boost_low_volume_projects_cache_key,
)
from sentry.testutils.cases import TestCase


def _project_volume(project_id: int, total: int = 100, keep: int = 25) -> ProjectVolume:
    return ProjectVolume(project_id=project_id, total=total, keep=keep, drop=max(total - keep, 0))


class ProjectBalancingCalculationsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.redis = get_redis_client_for_ds()

    def test_run_project_balancing_returns_rebalanced_projects(self) -> None:
        org = self.create_organization()
        project_with_volume = self.create_project(organization=org)
        project_without_volume = self.create_project(organization=org)
        config = Mock()
        config.organization = org
        config.projects = [project_with_volume, project_without_volume]
        config.get_sample_rate.return_value = 0.5
        rebalanced_projects = [
            RebalancedItem(id=project_with_volume.id, count=100, new_sample_rate=0.25),
            RebalancedItem(id=project_without_volume.id, count=0, new_sample_rate=1.0),
        ]

        with patch(
            "sentry.dynamic_sampling.per_org.tasks.calculations.ProjectsRebalancingModel.run",
            return_value=rebalanced_projects,
        ) as model_run:
            result = run_project_balancing(config, [_project_volume(project_with_volume.id)])

        model_run.assert_called_once()
        model_input = model_run.call_args.args[-1]
        assert isinstance(model_input, ProjectsRebalancingInput)
        assert model_input.sample_rate == 0.5
        assert model_input.classes == [
            RebalancedItem(id=project_with_volume.id, count=100),
            RebalancedItem(id=project_without_volume.id, count=0),
        ]
        assert result == rebalanced_projects

    def test_compare_rebalanced_projects_with_cache_logs_per_project(self) -> None:
        org = self.create_organization()
        project_with_volume = self.create_project(organization=org)
        project_without_volume = self.create_project(organization=org)
        config = Mock()
        config.organization = org
        rebalanced_projects = [
            RebalancedItem(id=project_with_volume.id, count=100, new_sample_rate=0.25),
            RebalancedItem(id=project_without_volume.id, count=0, new_sample_rate=1.0),
        ]
        cached_sample_rates = {
            project_with_volume.id: 0.2,
            project_without_volume.id: 0.96,
        }

        with patch("sentry.dynamic_sampling.per_org.tasks.calculations.logger.info") as logger_info:
            compare_rebalanced_projects_with_cache(config, rebalanced_projects, cached_sample_rates)

        assert [call.args for call in logger_info.call_args_list] == [
            ("dynamic_sampling.per_org.project_balancing_comparison",),
            ("dynamic_sampling.per_org.project_balancing_comparison",),
        ]
        assert [call.kwargs["extra"] for call in logger_info.call_args_list] == [
            {
                "org_id": org.id,
                "project_id": project_with_volume.id,
                "generic_metrics_sample_rate": 0.2,
                "eap_sample_rate": 0.25,
                "relative_deviation": pytest.approx(0.2),
                "is_equal": False,
            },
            {
                "org_id": org.id,
                "project_id": project_without_volume.id,
                "generic_metrics_sample_rate": 0.96,
                "eap_sample_rate": 1.0,
                "relative_deviation": pytest.approx(0.04),
                "is_equal": True,
            },
        ]

    def test_project_balancing_relative_tolerance(self) -> None:
        assert is_within_relative_tolerance(0.95, 1.0)
        assert is_within_relative_tolerance(1.05, 1.0)
        assert not is_within_relative_tolerance(0.94, 1.0)
        assert not is_within_relative_tolerance(1.06, 1.0)
        assert is_within_relative_tolerance(0.0, 0.0)
        assert not is_within_relative_tolerance(0.01, 0.0)
        assert not is_within_relative_tolerance(None, 1.0)

    def test_get_cached_rebalanced_project_sample_rates(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        cache_key = generate_boost_low_volume_projects_cache_key(org.id)
        self.redis.delete(cache_key)
        self.addCleanup(self.redis.delete, cache_key)
        self.redis.hset(cache_key, str(project.id), "0.25")

        assert get_cached_rebalanced_project_sample_rates(org.id) == {project.id: 0.25}
