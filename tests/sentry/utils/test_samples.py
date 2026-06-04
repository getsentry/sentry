from unittest import mock

import pytest
from django.core.exceptions import SuspiciousFileOperation

from sentry.models.project import Project
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils.platform_categories import CONSOLES
from sentry.utils.samples import create_sample_event, load_data


@pytest.mark.parametrize(
    "platform",
    [
        "/",
        "/..",
        "//....",
        "/%5c..",
        "../",
        "../../",
        "../../../etc/passwd",
    ],
)
def test_path_traversal_attempt_raises_exception(platform: str) -> None:
    with pytest.raises(SuspiciousFileOperation) as excinfo:
        load_data(platform)

    (msg,) = excinfo.value.args
    assert msg == "potential path traversal attack detected"


def test_missing_sample_returns_none() -> None:
    platform = "random-platform-that-does-not-exist"
    data = load_data(platform)

    assert data is None


def test_sample_as_directory_raises_exception(tmp_path) -> None:
    # override DATA_ROOT to a tmp directory
    with mock.patch("sentry.utils.samples.DATA_ROOT", tmp_path):
        # create a directory ending with `.json`
        samples_root = tmp_path / "samples" / "a_directory.json"
        samples_root.mkdir(parents=True)

        platform = "a_directory"
        with pytest.raises(IsADirectoryError) as excinfo:
            load_data(platform)

    (msg,) = excinfo.value.args
    assert msg == "expected file but found a directory instead"


@django_db_all(transaction=True)
class TestConsoleSamples:
    @pytest.mark.parametrize("platform", list(CONSOLES))
    def test_console_platforms_trigger_screenshot_attachment(
        self, default_project: Project, platform: str
    ):
        with mock.patch(
            "sentry.utils.samples.create_console_screenshot_attachment"
        ) as mock_attachment:
            event = create_sample_event(default_project, platform=platform)
            assert event is not None
            mock_attachment.assert_called_once_with(event, default_project, platform)

    def test_non_console_platforms_skip_screenshot_attachment(self, default_project):
        with mock.patch(
            "sentry.utils.samples.create_console_screenshot_attachment"
        ) as mock_attachment:
            event = create_sample_event(default_project, platform="python")
            assert event is not None
            mock_attachment.assert_not_called()

    # TODO(telemetry): Enable test when we have the screenshots
    # @pytest.mark.parametrize("platform", list(CONSOLES))
    # def test_console_platforms_create_screenshot_attachment(self, default_project, platform):
    #     from sentry.models.eventattachment import EventAttachment

    #     EventAttachment.objects.filter(project_id=default_project.id).delete()
    #     event = create_sample_event(default_project, platform=platform)
    #     assert event is not None
    #     attachments = EventAttachment.objects.filter(
    #         event_id=event.event_id, project_id=default_project.id, name="screenshot.png"
    #     )
    #     assert attachments.exists()
    #     attachment = attachments.first()
    #     assert attachment.content_type == "image/png"
    #     assert attachment.name == "screenshot.png"
    #     assert attachment.size > 0

    def test_screenshot_attachment_handles_error_gracefully(self, default_project):
        with mock.patch("sentry.utils.samples.load_console_screenshot") as mock_load:
            mock_load.return_value = None
            event = create_sample_event(default_project, platform="xbox")
            assert event is not None
            from sentry.models.eventattachment import EventAttachment

            attachments = EventAttachment.objects.filter(
                event_id=event.event_id, project_id=default_project.id, name="screenshot.png"
            )
            assert not attachments.exists()

    def test_screenshot_attachment_handles_database_error_gracefully(self, default_project):
        with mock.patch(
            "sentry.models.eventattachment.EventAttachment.objects.create"
        ) as mock_create:
            mock_create.side_effect = Exception("Database connection failed")
            event = create_sample_event(default_project, platform="xbox")
            assert event is not None
