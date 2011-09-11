"""
sentry.client.processors
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

class Processor(object):
    def process(self, data):
        resp = self.get_data(data)
        if resp:
            data['extra'].update(resp)
        return data
    
    def get_data(self, data):
        return {}

def sanitize_passwords_processor(data):
    """ Asterisk out passwords from password fields in frames.
    """
    if 'sentry.interfaces.Stacktrace' in data:
        if 'frames' in data['sentry.interfaces.Stacktrace']:
            for frame in data['sentry.interfaces.Stacktrace']['frames']:
                if 'vars' in frame:
                    for k,v in frame['vars'].iteritems():
                        if k.startswith('password'):
                            # store mask as a fixed length for security
                            frame['vars'][k] = '*'*16
    return data