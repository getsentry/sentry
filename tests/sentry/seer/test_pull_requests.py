from typing import Any
from unittest.mock import Mock, patch

from sentry.models.pullrequest import (
    PullRequest,
    PullRequestAttribution,
    PullRequestAttributionSignalType,
    PullRequestAttributionSource,
)
from sentry.seer.models.run import SeerRun, SeerRunPullRequest, SeerRunType
from sentry.seer.pull_requests import link_seer_run_pull_requests, notify_seer_pr_created
from sentry.seer.sentry_data_models import (
    NotifySeerPrCreatedErrorResponse,
    NotifySeerPrCreatedSuccessResponse,
)
from sentry.testutils.cases import TestCase

REPO_NAME = "getsentry/sentry"
RUN_STATE_ID = 123


def _warning_events(mock_logger: Mock) -> list[str]:
    return [call.args[0] for call in mock_logger.warning.call_args_list]


class LinkSeerRunPullRequestsTest(TestCase):
    def setUp(self) -> None:
        self.repo = self.create_repo(self.project, name=REPO_NAME, provider="integrations:github")
        self.seer_run = self.create_seer_run(
            self.organization, type=SeerRunType.FEATURE_RUN, seer_run_state_id=RUN_STATE_ID
        )

    def _payload(
        self,
        pr_number: int = 42,
        pr_url: str = "https://github.com/getsentry/sentry/pull/42",
        provider: str = "github",
    ) -> list[dict[str, Any]]:
        return [
            {
                "provider": provider,
                "repo_name": REPO_NAME,
                "pull_request": {"pr_id": 999, "pr_number": pr_number, "pr_url": pr_url},
            }
        ]

    def _link(
        self,
        pull_requests: list[dict[str, Any]],
        *,
        seer_run_state_id: int | None = RUN_STATE_ID,
    ) -> None:
        link_seer_run_pull_requests(
            organization=self.organization,
            seer_run_state_id=seer_run_state_id,
            pull_requests=pull_requests,
        )

    def test_creates_link_and_resolves_pull_request(self) -> None:
        self._link(self._payload())

        pull_request = PullRequest.objects.get(repository_id=self.repo.id, key="42")
        link = SeerRunPullRequest.objects.get(pull_request=pull_request)
        assert link.seer_run_id == self.seer_run.id
        assert list(self.seer_run.pull_requests) == [pull_request]

    def test_first_run_keeps_pull_request(self) -> None:
        self._link(self._payload())

        other_run = self.create_seer_run(
            self.organization, type=SeerRunType.FEATURE_RUN, seer_run_state_id=456
        )
        link_seer_run_pull_requests(
            organization=self.organization,
            seer_run_state_id=456,
            pull_requests=self._payload(),
        )

        pull_request = PullRequest.objects.get(repository_id=self.repo.id, key="42")
        link = SeerRunPullRequest.objects.get(pull_request=pull_request)
        assert link.seer_run_id == self.seer_run.id
        assert link.seer_run_id != other_run.id

    def test_links_multiple_pull_requests(self) -> None:
        self._link(self._payload() + self._payload(pr_number=43))

        assert SeerRunPullRequest.objects.filter(seer_run=self.seer_run).count() == 2

    def test_noop_when_run_id_missing(self) -> None:
        self._link(self._payload(), seer_run_state_id=None)
        assert not SeerRunPullRequest.objects.exists()

    @patch("sentry.seer.pull_requests.logger")
    def test_missing_fields_skipped(self, mock_logger: Mock) -> None:
        self._link([{"provider": "github", "pull_request": {"pr_number": None}}])

        assert not SeerRunPullRequest.objects.exists()
        assert "seer.pr_link.missing_fields" in _warning_events(mock_logger)

    @patch("sentry.seer.pull_requests.logger")
    def test_unresolvable_repo_skipped(self, mock_logger: Mock) -> None:
        self._link(
            [
                {
                    "provider": "github",
                    "repo_name": "getsentry/does-not-exist",
                    "pull_request": {"pr_number": 42},
                }
            ]
        )

        assert not SeerRunPullRequest.objects.exists()
        assert "seer.pr_link.repo_unresolved" in _warning_events(mock_logger)

    @patch("sentry.seer.pull_requests.options.get", return_value=True)
    def test_killswitch_disables_writes(self, mock_option: Mock) -> None:
        self._link(self._payload())

        mock_option.assert_called_once_with("seer.pull-request-linking.killswitch.enabled")
        assert not SeerRunPullRequest.objects.exists()
        assert not PullRequest.objects.filter(repository_id=self.repo.id, key="42").exists()

    def test_run_lookup_is_org_scoped(self) -> None:
        """A run id that exists only in another org must not link here."""
        other_org = self.create_organization()
        SeerRun.objects.filter(id=self.seer_run.id).update(organization=other_org)

        self._link(self._payload())

        assert not SeerRunPullRequest.objects.exists()


PR_NUMBER = 7412
PR_URL = "https://github.com/getsentry/sentry/pull/7412"


class NotifySeerPrCreatedTest(TestCase):
    def setUp(self) -> None:
        self.repo = self.create_repo(self.project, name=REPO_NAME, provider="integrations:github")
        self.seer_run = self.create_seer_run(
            self.organization, type=SeerRunType.FEATURE_RUN, seer_run_state_id=RUN_STATE_ID
        )

    def _payload(
        self,
        pr_number: int = PR_NUMBER,
        pr_url: str = PR_URL,
        provider: str = "github",
    ) -> list[dict[str, Any]]:
        return [
            {
                "provider": provider,
                "repo_name": REPO_NAME,
                "pull_request": {"pr_id": 999, "pr_number": pr_number, "pr_url": pr_url},
            }
        ]

    def _notify(
        self,
        pull_requests: list[dict[str, Any]],
        *,
        run_id: int = RUN_STATE_ID,
        group_id: int | None = None,
    ) -> NotifySeerPrCreatedSuccessResponse | NotifySeerPrCreatedErrorResponse:
        return notify_seer_pr_created(
            organization_id=self.organization.id,
            run_id=run_id,
            pull_requests=pull_requests,
            group_id=group_id,
        )

    def _linked_pull_request(self) -> PullRequest:
        return PullRequest.objects.get(repository_id=self.repo.id, key=str(PR_NUMBER))

    def test_groupless_run_links_and_attributes(self) -> None:
        """A run with no issue (group_id=None) still links the PR and records a
        SENTRY_APP/SEER_DATA attribution when the attribution flag is on."""
        with self.feature("organizations:pr-metrics-attribution"):
            result = self._notify(self._payload(), group_id=None)

        assert isinstance(result, NotifySeerPrCreatedSuccessResponse)

        pull_request = self._linked_pull_request()
        link = SeerRunPullRequest.objects.get(pull_request=pull_request)
        assert link.seer_run_id == self.seer_run.id

        attribution = PullRequestAttribution.objects.get(pull_request=pull_request)
        assert attribution.signal_type == PullRequestAttributionSignalType.SENTRY_APP
        assert attribution.source == PullRequestAttributionSource.SEER_DATA
        assert attribution.signal_details == {
            "run_id": RUN_STATE_ID,
            "group_ids": [],
            "pr_url": PR_URL,
        }

    def test_group_present_populates_attribution_group_ids(self) -> None:
        with self.feature("organizations:pr-metrics-attribution"):
            self._notify(self._payload(), group_id=self.group.id)

        attribution = PullRequestAttribution.objects.get(pull_request=self._linked_pull_request())
        assert attribution.signal_details is not None
        assert attribution.signal_details["group_ids"] == [self.group.id]

    def test_idempotent_on_redelivery(self) -> None:
        with self.feature("organizations:pr-metrics-attribution"):
            self._notify(self._payload(), group_id=None)
            self._notify(self._payload(), group_id=None)

        pull_request = self._linked_pull_request()
        assert SeerRunPullRequest.objects.filter(pull_request=pull_request).count() == 1
        assert PullRequestAttribution.objects.filter(pull_request=pull_request).count() == 1

    @patch("sentry.seer.entrypoints.operator.SeerAutofixOperator.has_access", return_value=False)
    def test_links_regardless_of_operator_access(self, mock_has_access: Mock) -> None:
        """The new path must not consult ``SeerAutofixOperator.has_access``: linking
        happens even when operator access would be denied."""
        with self.feature("organizations:pr-metrics-attribution"):
            result = self._notify(self._payload(), group_id=None)

        assert isinstance(result, NotifySeerPrCreatedSuccessResponse)
        assert SeerRunPullRequest.objects.filter(pull_request=self._linked_pull_request()).exists()
        mock_has_access.assert_not_called()

    def test_links_without_attribution_when_flag_disabled(self) -> None:
        """Attribution flag off: still links, but writes no attribution row."""
        result = self._notify(self._payload(), group_id=None)

        assert isinstance(result, NotifySeerPrCreatedSuccessResponse)
        pull_request = self._linked_pull_request()
        assert SeerRunPullRequest.objects.filter(pull_request=pull_request).exists()
        assert not PullRequestAttribution.objects.filter(pull_request=pull_request).exists()

    def test_returns_error_when_organization_missing(self) -> None:
        result = notify_seer_pr_created(
            organization_id=self.organization.id + 10_000,
            run_id=RUN_STATE_ID,
            pull_requests=self._payload(),
        )

        assert isinstance(result, NotifySeerPrCreatedErrorResponse)
        assert result.error == "Organization not found or not active"
        assert not SeerRunPullRequest.objects.exists()
