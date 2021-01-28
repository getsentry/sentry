from sentry.buffer import Buffer


class InProcessBuffer(Buffer):
    """
    In-process buffer which computes changes in real-time.

    **Note**: This does not actually buffer anything, and should only be used
              in development and testing environments.
    """

    def incr(self, model, columns, filters, extra=None, signal_only=None):
        self.process(model, columns, filters, extra, signal_only)
