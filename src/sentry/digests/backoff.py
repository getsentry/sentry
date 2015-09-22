class BackoffStrategy(object):
    def __call__(self, iteration):
        raise NotImplementedError


class IntervalBackoffStrategy(BackoffStrategy):
    def __init__(self, interval=60):
        self.interval = interval

    def __call__(self, iteration):
        return self.interval
