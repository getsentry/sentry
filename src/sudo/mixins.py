from sudo.decorators import sudo_required


class SudoMixin(object):
    @classmethod
    def as_view(cls, **initkwargs):
        view = super(SudoMixin, cls).as_view(**initkwargs)
        return sudo_required(view)
