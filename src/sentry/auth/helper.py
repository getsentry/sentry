from __future__ import absolute_import, print_function

from hashlib import md5


class AuthHelper(object):
    """
    Helper class which is passed into AuthView's.

    Designed to link provider and views as well as manage the state and
    pipeline.
    """
    def __init__(self, request, provider):
        self.request = request
        self.provider = provider
        self.pipeline = provider.get_auth_pipeline()
        # we serialize the pipeline to be [AuthView().get_ident(), ...] which
        # allows us to determine if the pipeline has changed during the auth
        # flow or if the user is somehow circumventing a chunk of it
        self.signature = md5(' '.join(av.get_ident() for av in self.pipeline)).hexdigest()

    def pipeline_is_valid(self):
        current_session = self.request.session.get('auth_pipeline', {})
        if not current_session:
            return False
        return current_session.get('sig') == self.signature

    def reset_pipeline(self):
        current_session = {
            'idx': 0,
            'sig': self.signature,
            'state': {},
        }
        self.request.session['auth'] = current_session
        self.request.session.is_modified = True

    def get_current_view(self):
        return self.provider.pipeline[self.request.session['auth']['idx']]

    def get_next_url(self):
        # each step url should be something like md5(cls_path)
        return self.request.path

    def get_current_url(self):
        return self.request.path

    def next_step(self):
        # TODO: this needs to somehow embed the next step
        # (it shouldnt force an exteneral redirect)
        return self.redirect(self.get_next_url())

    def error(self, message):
        raise NotImplementedError

    def bind_state(self, key, value):
        self.request.session['auth']['state'][key] = value
        self.request.session.is_modified = True

    def fetch_state(self, key):
        return self.request.session['auth']['state'].get(key)
