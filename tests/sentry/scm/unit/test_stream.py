from sentry.scm.private.event_stream import SourceCodeManagerEventStream
from sentry.scm.types import (
    CheckRunEvent,
    CheckSuiteEvent,
    CommentEvent,
    PullRequestEvent,
    PullRequestReviewEvent,
)


def test_listener_registration() -> None:
    scm = SourceCodeManagerEventStream()

    @scm.listen_for("check_run")
    def cr_listener(event: CheckRunEvent) -> None:
        pass

    @scm.listen_for("comment")
    def comment_listener(event: CommentEvent) -> None:
        pass

    @scm.listen_for("pull_request")
    def pr_listener(event: PullRequestEvent) -> None:
        pass

    @scm.listen_for("pull_request")
    def pr_listener_2(event: PullRequestEvent) -> None:
        pass

    @scm.listen_for("check_suite")
    def cs_listener(event: CheckSuiteEvent) -> None:
        pass

    @scm.listen_for("pull_request_review")
    def prr_listener(event: PullRequestReviewEvent) -> None:
        pass

    # Assert our scm instance had listeners registered to it.
    assert scm.check_run_listeners == {cr_listener.__name__: cr_listener}
    assert scm.comment_listeners == {comment_listener.__name__: comment_listener}
    assert scm.pull_request_listeners == {
        pr_listener.__name__: pr_listener,
        pr_listener_2.__name__: pr_listener_2,
    }
    assert scm.check_suite_listeners == {cs_listener.__name__: cs_listener}
    assert scm.pull_request_review_listeners == {prr_listener.__name__: prr_listener}
