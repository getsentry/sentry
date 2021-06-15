from sudo.decorators import sudo_required


class SudoMixin:
    @classmethod
    def as_view(cls, **initkwargs):
        view = super().as_view(**initkwargs)
        return sudo_required(view)
