from datetime import timedelta
from unittest import mock
from unittest.mock import call

from django.utils import timezone

from sentry.locks import locks
from sentry.models.project import Project
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.uptime.detectors.ranking import (
    NUMBER_OF_BUCKETS,
    _get_cluster,
    add_base_url_to_rank,
    get_project_bucket,
)
from sentry.uptime.detectors.tasks import (
    LAST_PROCESSED_KEY,
    ONBOARDING_SUBSCRIPTION_INTERVAL_SECONDS,
    SCHEDULER_LOCK_KEY,
    is_failed_url,
    process_candidate_url,
    process_detection_bucket,
    process_project_url_ranking,
    schedule_detections,
    set_failed_url,
)
from sentry.uptime.models import ProjectUptimeSubscription


@freeze_time()
class ScheduleDetectionsTest(TestCase):
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
class ProcessDetectionBucketTest(TestCase):
    def test_empty_bucket(self):
        with mock.patch(
            "sentry.uptime.detectors.tasks.process_project_url_ranking"
        ) as mock_process_project_url_ranking:
            process_detection_bucket(timezone.now().replace(second=0, microsecond=0))
            mock_process_project_url_ranking.delay.assert_not_called()

    def test_bucket(self):
        bucket = timezone.now().replace(second=0, microsecond=0)
        dummy_project_id = int(bucket.timestamp() % NUMBER_OF_BUCKETS)
        self.project.id = dummy_project_id
        other_project = Project(dummy_project_id + NUMBER_OF_BUCKETS)
        add_base_url_to_rank(self.project, "https://sentry.io")
        add_base_url_to_rank(other_project, "https://sentry.io")

        with mock.patch(
            "sentry.uptime.detectors.tasks.process_project_url_ranking"
        ) as mock_process_project_url_ranking:
            process_detection_bucket(bucket)
            mock_process_project_url_ranking.delay.assert_has_calls(
                [call(self.project.id, 1), call(other_project.id, 1)], any_order=True
            )

        assert get_project_bucket(bucket) == {}


@freeze_time()
class ProcessProjectUrlRankingTest(TestCase):
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
            process_project_url_ranking(self.project.id, 5)
            mock_process_candidate_url.assert_has_calls(
                [
                    call(self.project, 5, url_1, 2),
                    call(self.project, 5, url_2, 1),
                ]
            )

    def test_should_not_detect(self):
        with mock.patch(
            # TODO: Replace this mock with real tests when we implement this function properly
            "sentry.uptime.detectors.tasks.should_detect_for_project",
            return_value=False,
        ), mock.patch(
            "sentry.uptime.detectors.tasks.get_candidate_urls_for_project"
        ) as mock_get_candidate_urls_for_project:
            process_project_url_ranking(self.project.id, 5)
            mock_get_candidate_urls_for_project.assert_not_called()


@freeze_time()
class ProcessCandidateUrlTest(TestCase):
    def test_succeeds_new(self):
        assert process_candidate_url(self.project, 100, "https://sentry.io", 50)

    def test_succeeds_existing_subscription_other_project(self):
        other_project = self.create_project()
        url = "https://sentry.io"
        uptime_subscription = self.create_uptime_subscription(
            url=url, interval_seconds=ONBOARDING_SUBSCRIPTION_INTERVAL_SECONDS
        )
        self.create_project_uptime_subscription(
            project=other_project, uptime_subscription=uptime_subscription
        )
        assert (
            ProjectUptimeSubscription.objects.filter(
                project=self.project, uptime_subscription=uptime_subscription
            ).count()
            == 0
        )
        assert process_candidate_url(self.project, 100, url, 50)
        assert (
            ProjectUptimeSubscription.objects.filter(
                project=self.project, uptime_subscription=uptime_subscription
            ).count()
            == 1
        )

    def test_succeeds_existing_subscription_this_project(self):
        url = "https://sentry.io"
        uptime_subscription = self.create_uptime_subscription(url=url, interval_seconds=300)
        self.create_project_uptime_subscription(
            project=self.project, uptime_subscription=uptime_subscription
        )
        assert process_candidate_url(self.project, 100, url, 50)
        assert (
            ProjectUptimeSubscription.objects.filter(
                project=self.project, uptime_subscription=uptime_subscription
            ).count()
            == 1
        )
        # TODO: Check no other subscriptions or anything made once we finish the rest of this func

    def test_below_thresholds(self):
        assert not process_candidate_url(self.project, 500, "https://sentry.io", 1)
        assert not process_candidate_url(self.project, 500, "https://sentry.io", 10)

    def test_failed_url(self):
        url = "https://sentry.io"
        set_failed_url(url)
        assert not process_candidate_url(self.project, 100, url, 50)

    def test_failed_robots_txt(self):
        url = "https://sentry.io"
        with mock.patch(
            # TODO: Replace this mock with real tests when we implement this function properly
            "sentry.uptime.detectors.tasks.check_url_robots_txt",
            return_value=False,
        ):
            assert not process_candidate_url(self.project, 100, url, 50)
        assert is_failed_url(url)


class TestFailedUrl(TestCase):
    def test(self):
        url = "https://sentry.io"
        assert not is_failed_url(url)
        set_failed_url(url)
        assert is_failed_url(url)
        assert not is_failed_url("https://sentry.sentry.io")
