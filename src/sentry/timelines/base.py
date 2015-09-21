class Backend(object):
    pass


class Backoff(object):
    def __init__(self, function, maximum_steps=2):
        self.function = function
        self.maximum_steps = maximum_steps

    def __call__(self, step):
        return self.function(min(step, self.maximum_steps))

    @property
    def maximum(self):
        return self(self.maximum_steps)
