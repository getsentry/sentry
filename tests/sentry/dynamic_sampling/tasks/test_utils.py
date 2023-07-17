from freezegun import freeze_time

from sentry.dynamic_sampling.tasks.utils import Timer


def test_timer_raw():
    """
    Tests the direct functionality of Timer (i.e. not as a context manager)
    """

    t = Timer()
    with freeze_time("2023-07-12 10:00:00") as frozen_time:
        # timer is not started, so it should have a 0 interval
        assert t.current() == 0

        t.start()
        t.stop()
        # no time has passed
        assert t.current() == 0

        t.start()
        # still no time passed
        assert t.current() == 0
        t.stop()

        # jump 1 second in the future
        frozen_time.tick()

        # the timer is stopped so nothing should have happened
        assert t.current() == 0

        # stopping and starting should not do anything either since no time
        # is advancing at the moment
        t.start()
        assert t.current() == 0
        t.stop()
        assert t.current() == 0

        # start and jump another second
        t.start()

        # another sec
        frozen_time.tick()

        # now the timer should be at 1 sec
        assert t.current() == 1.0

        # stopping and starting it at this point should still be at 1 sec
        t.start()
        assert t.current() == 1.0
        t.stop()
        assert t.current() == 1.0
        t.start()
        assert t.current() == 1.0
        t.stop()
        assert t.current() == 1.0

        frozen_time.tick()
        # check that we can accumulate multiple stops and starts
        assert t.current() == 1.0
        t.start()
        assert t.current() == 1.0

        # another sec
        frozen_time.tick()

        assert t.current() == 2.0
        t.stop()
        assert t.current() == 2.0
        t.start()
        assert t.current() == 2.0
        t.stop()
        assert t.current() == 2.0
        t.reset()
        assert t.current() == 0.0
        t.start()
        assert t.current() == 0.0
        t.stop()
        assert t.current() == 0.0
        t.start()

        # another sec
        frozen_time.tick()

        assert t.current() == 1.0


def test_timer_context_manager():
    """
    Tests the context manager functionality of the timer
    """
    with freeze_time("2023-07-12 10:00:00") as frozen_time:
        t = Timer()
        for i in range(3):
            with t:
                # only the seconds advanced within the counter should be counted
                assert t.current() == i

                # jump one sec
                frozen_time.tick()
            frozen_time.tick()

        # we advanced 3 seconds within the timer and 3 outside we should have only counted 3
        assert t.current() == 3
