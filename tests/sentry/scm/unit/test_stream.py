from sentry.scm.stream import scm_event_stream


def test_listener_registration():
    scm = type(scm_event_stream)()

    @scm.listen_for("check_run")
    def cr_listener(event):
        pass

    @scm.listen_for("comment")
    def comment_listener(event):
        pass

    @scm.listen_for("pull_request")
    def pr_listener(event):
        pass

    @scm.listen_for("pull_request")
    def pr_listener_2(event):
        pass

    # Assert our scm instance had listeners registered to it.
    assert scm.check_run_listeners == {cr_listener.__name__: cr_listener}
    assert scm.comment_listeners == {comment_listener.__name__: comment_listener}
    assert scm.pull_request_listeners == {
        pr_listener.__name__: pr_listener,
        pr_listener_2.__name__: pr_listener_2,
    }

    # Assert the global scm_event_stream was not modified. Proves we're not assigning to some
    # leaky property.
    assert scm_event_stream.check_run_listeners == {}
    assert scm_event_stream.comment_listeners == {}
    assert scm_event_stream.pull_request_listeners == {}
