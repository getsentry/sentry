from __future__ import absolute_import


class Problem(object):
    def __init__(self, message):
        self.message = unicode(message)

    def __str__(self):
        return self.message.encode('utf-8')

    def __unicode__(self):
        return self.message


class StatusCheck(object):
    def check(self):
        """
        Perform required checks and return a list of ``Problem`` instances.
        """
        raise NotImplementedError
