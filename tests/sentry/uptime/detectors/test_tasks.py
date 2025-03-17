from __future__ import annotations

from datetime import datetime, timedelta
from unittest import mock
from unittest.mock import call
from urllib.robotparser import RobotFileParser

from django.utils import timezone

from sentry.locks import locks
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.testutils.cases import UptimeTestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.datetime import freeze_time
from sentry.uptime.detectors.ranking import (
    NUMBER_OF_BUCKETS,
    _get_cluster,
    add_base_url_to_rank,
    get_organization_bucket,
    get_project_base_url_rank_key,
)
from sentry.uptime.detectors.tasks import (
    LAST_PROCESSED_KEY,
    ONBOARDING_SUBSCRIPTION_INTERVAL_SECONDS,
    SCHEDULER_LOCK_KEY,
    is_failed_url,
    monitor_url_for_project,
    process_candidate_url,
    process_detection_bucket,
    process_organization_url_ranking,
    process_project_url_ranking,
    schedule_detections,
    set_failed_url,
)
from sentry.uptime.models import ProjectUptimeSubscription, ProjectUptimeSubscriptionMode
from sentry.uptime.subscriptions.subscriptions import (
    get_auto_monitored_subscriptions_for_project,
    is_url_auto_monitored_for_project,
)


@freeze_time()
class ScheduleDetectionsTest(UptimeTestCase):
    def test_no_last_processed(self):
        # The first time this runs we don't expect much to happen,
        # just that it'll update the last processed date in redis
        cluster = _get_cluster()
        assert not cluster.get(LAST_PROCESSED_KEY)
        with mock.patch(
            "sentry.uptime.detectors.tasks.process_detection_bucket"
        ) as mock_process_detection_bucket:
            schedule_detections()
            mock_process_detection_bucket.delay.assert_not_called()
        last_processed = cluster.get(LAST_PROCESSED_KEY)
        assert last_processed is not None
        assert int(last_processed) == int(
            timezone.now().replace(second=0, microsecond=0).timestamp()
        )

    def test_processes(self):
        cluster = _get_cluster()
        current_bucket = timezone.now().replace(second=0, microsecond=0)
        last_processed_bucket = current_bucket - timedelta(minutes=10)
        cluster.set(LAST_PROCESSED_KEY, int(last_processed_bucket.timestamp()))
        with mock.patch(
            "sentry.uptime.detectors.tasks.process_detection_bucket"
        ) as mock_process_detection_bucket:
            schedule_detections()
            mock_process_detection_bucket.delay.assert_has_calls(
                [call(last_processed_bucket + timedelta(minutes=i)) for i in range(1, 11)]
            )
        last_processed = cluster.get(LAST_PROCESSED_KEY)
        assert last_processed is not None
        assert int(last_processed) == int(
            timezone.now().replace(second=0, microsecond=0).timestamp()
        )

    def test_lock(self):
        lock = locks.get(
            SCHEDULER_LOCK_KEY,
            duration=60,
            name="uptime.detection.schedule_detections",
        )
        with lock.acquire(), mock.patch("sentry.uptime.detectors.tasks.metrics") as metrics:
            schedule_detections()
            metrics.incr.assert_called_once_with(
                "uptime.detectors.scheduler.unable_to_acquire_lock"
            )


@freeze_time()
class ProcessDetectionBucketTest(UptimeTestCase):
    def test_empty_bucket(self):
        with mock.patch(
            "sentry.uptime.detectors.tasks.process_organization_url_ranking"
        ) as mock_process_project_url_ranking:
            process_detection_bucket(timezone.now().replace(second=0, microsecond=0))
            mock_process_project_url_ranking.delay.assert_not_called()

    def test_bucket(self):
        bucket = datetime(2024, 7, 18, 0, 21)
        dummy_organization_id = 21

        self.project.organization = Organization(id=dummy_organization_id)

        other_project = Project(
            id=1245, organization=Organization(id=dummy_organization_id + NUMBER_OF_BUCKETS)
        )
        add_base_url_to_rank(self.project, "https://sentry.io")
        add_base_url_to_rank(other_project, "https://sentry.io")

        with mock.patch(
            "sentry.uptime.detectors.tasks.process_organization_url_ranking"
        ) as mock_process_organization_url_ranking:
            process_detection_bucket(bucket)
            mock_process_organization_url_ranking.delay.assert_has_calls(
                [call(self.project.organization.id), call(other_project.organization.id)],
                any_order=True,
            )

        assert get_organization_bucket(bucket) == set()


@freeze_time()
class ProcessOrganizationUrlRankingTest(UptimeTestCase):
    def test(self):
        # TODO: Better testing for this function when we implement things that happen on success
        url_1 = "https://sentry.io"
        url_2 = "https://sentry.sentry.io"
        project_2 = self.create_project()
        add_base_url_to_rank(self.project, url_2)
        add_base_url_to_rank(self.project, url_1)
        add_base_url_to_rank(self.project, url_1)
        add_base_url_to_rank(project_2, url_1)
        with mock.patch(
            "sentry.uptime.detectors.tasks.process_project_url_ranking",
            return_value=False,
        ) as mock_process_project_url_ranking:
            process_organization_url_ranking(self.organization)
            mock_process_project_url_ranking.assert_has_calls(
                [
                    call(self.project, 3),
                    call(project_2, 1),
                ]
            )

    def test_should_not_detect_project(self):
        with mock.patch(
            "sentry.uptime.detectors.tasks.get_candidate_urls_for_project"
        ) as mock_get_candidate_urls_for_project:
            self.project.update_option("sentry:uptime_autodetection", False)
            assert not process_project_url_ranking(self.project, 5)
            mock_get_candidate_urls_for_project.assert_not_called()

    def test_should_not_detect_organization(self):
        url_1 = "https://sentry.io"
        url_2 = "https://sentry.sentry.io"
        project_2 = self.create_project()
        add_base_url_to_rank(self.project, url_2)
        add_base_url_to_rank(self.project, url_1)
        add_base_url_to_rank(self.project, url_1)
        add_base_url_to_rank(project_2, url_1)

        keys = [
            get_project_base_url_rank_key(self.project),
            get_project_base_url_rank_key(project_2),
        ]
        redis = _get_cluster()
        assert all(redis.exists(key) for key in keys)

        with mock.patch(
            "sentry.uptime.detectors.tasks.get_candidate_urls_for_project"
        ) as mock_get_candidate_urls_for_project:
            self.organization.update_option("sentry:uptime_autodetection", False)
            assert not process_organization_url_ranking(self.organization.id)
            mock_get_candidate_urls_for_project.assert_not_called()
            assert all(not redis.exists(key) for key in keys)


@freeze_time()
class ProcessProjectUrlRankingTest(UptimeTestCase):
    def test(self):
        # TODO: Better testing for this function when we implement things that happen on success
        url_1 = "https://sentry.io"
        url_2 = "https://sentry.sentry.io"
        add_base_url_to_rank(self.project, url_2)
        add_base_url_to_rank(self.project, url_1)
        add_base_url_to_rank(self.project, url_1)
        with mock.patch(
            "sentry.uptime.detectors.tasks.process_candidate_url",
            return_value=False,
        ) as mock_process_candidate_url:
            assert not process_project_url_ranking(self.project, 5)
            mock_process_candidate_url.assert_has_calls(
                [
                    call(self.project, 5, url_1, 2),
                    call(self.project, 5, url_2, 1),
                ]
            )

    def test_should_not_detect(self):
        self.project.update_option("sentry:uptime_autodetection", False)
        with mock.patch(
            "sentry.uptime.detectors.tasks.get_candidate_urls_for_project"
        ) as mock_get_candidate_urls_for_project:
            assert not process_project_url_ranking(self.project, 5)
            mock_get_candidate_urls_for_project.assert_not_called()


@freeze_time()
class ProcessCandidateUrlTest(UptimeTestCase):
    @with_feature(["organizations:uptime", "organizations:uptime-automatic-subscription-creation"])
    def test_succeeds_new(self):
        url = "https://sentry.io"
        assert not is_url_auto_monitored_for_project(self.project, url)
        assert process_candidate_url(self.project, 100, url, 50)
        assert is_url_auto_monitored_for_project(self.project, url)
        assert self.project.get_option("sentry:uptime_autodetection") is False
        assert self.organization.get_option("sentry:uptime_autodetection") is False

    def test_succeeds_new_no_feature(self):
        with mock.patch(
            "sentry.uptime.detectors.tasks.monitor_url_for_project"
        ) as mock_monitor_url_for_project:
            assert process_candidate_url(self.project, 100, "https://sentry.io", 50)
            mock_monitor_url_for_project.assert_not_called()
            assert self.project.get_option("sentry:uptime_autodetection") is None
            assert self.organization.get_option("sentry:uptime_autodetection") is None

        with self.feature(["organizations:uptime"]):
            assert process_candidate_url(self.project, 100, "https://sentry.io", 50)
            mock_monitor_url_for_project.assert_not_called()

    @with_feature(["organizations:uptime", "organizations:uptime-automatic-subscription-creation"])
    def test_succeeds_existing_subscription_other_project(self):
        other_project = self.create_project()
        url = "https://sentry.io"
        uptime_subscription = self.create_uptime_subscription(
            url=url, interval_seconds=ONBOARDING_SUBSCRIPTION_INTERVAL_SECONDS
        )
        self.create_project_uptime_subscription(
            project=other_project, uptime_subscription=uptime_subscription
        )
        assert not is_url_auto_monitored_for_project(self.project, url)
        assert process_candidate_url(self.project, 100, url, 50)
        assert is_url_auto_monitored_for_project(self.project, url)
        assert self.project.get_option("sentry:uptime_autodetection") is False
        assert self.organization.get_option("sentry:uptime_autodetection") is False

    @with_feature(["organizations:uptime", "organizations:uptime-automatic-subscription-creation"])
    def test_succeeds_existing_subscription_this_project(self):
        url = "https://sentry.io"
        assert process_candidate_url(self.project, 100, url, 50)
        subscription = get_auto_monitored_subscriptions_for_project(self.project)[0]
        assert process_candidate_url(self.project, 100, url, 50)
        new_subscription = get_auto_monitored_subscriptions_for_project(self.project)[0]
        assert subscription.id == new_subscription.id
        assert self.project.get_option("sentry:uptime_autodetection") is False
        assert self.organization.get_option("sentry:uptime_autodetection") is False

    def test_below_thresholds(self):
        assert not process_candidate_url(self.project, 500, "https://sentry.io", 1)
        assert not process_candidate_url(self.project, 500, "https://sentry.io", 10)

    def test_failed_url(self):
        url = "https://sentry.io"
        set_failed_url(url)
        assert not process_candidate_url(self.project, 100, url, 50)

    def test_failed_robots_txt(self):
        url = "https://sentry.io"
        test_robot_parser = RobotFileParser()
        robots_txt = ["User-agent: *", "Disallow: /"]
        test_robot_parser.parse(robots_txt)
        with mock.patch(
            "sentry.uptime.detectors.tasks.get_robots_txt_parser",
            return_value=test_robot_parser,
        ):
            assert not process_candidate_url(self.project, 100, url, 50)
        assert is_failed_url(url)

    def test_failed_robots_txt_user_agent(self):
        url = "https://sentry.io"
        test_robot_parser = RobotFileParser()
        robots_txt = ["User-agent: SentryUptimeBot", "Disallow: /"]
        test_robot_parser.parse(robots_txt)
        with mock.patch(
            "sentry.uptime.detectors.tasks.get_robots_txt_parser",
            return_value=test_robot_parser,
        ):
            assert not process_candidate_url(self.project, 100, url, 50)
        assert is_failed_url(url)

    def test_succeeded_robots_txt(self):
        url = "https://sentry.io"
        test_robot_parser = RobotFileParser()
        robots_txt = ["User-agent: *", "Allow: /", "Disallow: /no-robos"]
        test_robot_parser.parse(robots_txt)
        with mock.patch(
            "sentry.uptime.detectors.tasks.get_robots_txt_parser",
            return_value=test_robot_parser,
        ):
            assert process_candidate_url(self.project, 100, url, 50)

    def test_no_robots_txt(self):
        # Supplying no robots txt should allow all urls
        url = "https://sentry.io"
        test_robot_parser = RobotFileParser()
        robots_txt: list[str] = []
        test_robot_parser.parse(robots_txt)
        with mock.patch(
            "sentry.uptime.detectors.tasks.get_robots_txt_parser",
            return_value=test_robot_parser,
        ):
            assert process_candidate_url(self.project, 100, url, 50)

    def test_error_robots_txt(self):
        # Supplying no robots txt should allow all urls
        url = "https://sentry.io"
        with mock.patch(
            "sentry.uptime.detectors.tasks.get_robots_txt_parser",
            side_effect=Exception("Robots.txt fetch failed"),
        ):
            assert process_candidate_url(self.project, 100, url, 50)


class TestFailedUrl(UptimeTestCase):
    def test(self):
        url = "https://sentry.io"
        assert not is_failed_url(url)
        set_failed_url(url)
        assert is_failed_url(url)
        assert not is_failed_url("https://sentry.sentry.io")


class TestMonitorUrlForProject(UptimeTestCase):
    def test(self):
        url = "http://sentry.io"
        assert not is_url_auto_monitored_for_project(self.project, url)
        monitor_url_for_project(self.project, url)
        assert is_url_auto_monitored_for_project(self.project, url)

    def test_existing(self):
        url = "http://sentry.io"
        monitor_url_for_project(self.project, url)
        assert is_url_auto_monitored_for_project(self.project, url)
        url_2 = "http://santry.io"
        monitor_url_for_project(self.project, url_2)
        assert not is_url_auto_monitored_for_project(self.project, url)
        assert is_url_auto_monitored_for_project(self.project, url_2)

    def test_manual_existing(self):
        manual_url = "https://sentry.io"
        self.create_project_uptime_subscription(
            uptime_subscription=self.create_uptime_subscription(url=manual_url),
            mode=ProjectUptimeSubscriptionMode.MANUAL,
        )
        url = "http://santry.io"
        monitor_url_for_project(self.project, url)
        assert is_url_auto_monitored_for_project(self.project, url)
        assert ProjectUptimeSubscription.objects.filter(
            project=self.project,
            mode=ProjectUptimeSubscriptionMode.MANUAL,
            uptime_subscription__url=manual_url,
        ).exists()
