from django.contrib.admin import FieldListFilter
from django.contrib.admin.options import IncorrectLookupParameters
from django.core.exceptions import ValidationError
from django.db.models import F
from django.utils.translation import ugettext_lazy as _

from bitfield import Bit
from bitfield.compat import bitor


class BitFieldListFilter(FieldListFilter):
    def __init__(self, field, request, params, model, model_admin, field_path):
        self.lookup_kwarg = field_path
        self.lookup_val = int(request.GET.get(self.lookup_kwarg, 0))
        self.flags = field.flags
        self.labels = field.labels
        super().__init__(field, request, params, model, model_admin, field_path)

    def queryset(self, request, queryset):
        """
        :param request: the current HTTPRequest object
        :param queryset: the base queryset to be filtered
        """
        _filter = {p: bitor(F(p), v) for p, v in self.used_parameters.items()}
        try:
            return queryset.filter(**_filter)
        except ValidationError as e:
            raise IncorrectLookupParameters(e)

    def expected_parameters(self):
        return [self.lookup_kwarg]

    def choices(self, cl):
        """
        :param self:
            The :class:`~django.db.models.query_utils.Q` object for the current search, which is used to check whether the bit mask of each flag
        has been set or not (see :meth:`~django_bitmask_q.BitMaskFieldListFilter._choices`, below).

        :param cl: 
            The ``ChangeList`` class associated with
        the admin view that contains this filter (see :class:`.BitMaskFieldListFilter`, below). This is used to generate a query string containing all of the
        flags in their currently-selected state, so that clicking on a particular choice will preserve those settings across requests without having to use
        cookies or other persistent storage mechanisms (which would be prohibitively expensive for large datasets).
        """
        yield {
            "selected": self.lookup_val == 0,
            "query_string": cl.get_query_string({}, [self.lookup_kwarg]),
            "display": _("All"),
        }
        for number, flag in enumerate(self.flags):
            bit_mask = Bit(number).mask
            yield {
                "selected": self.lookup_val == bit_mask,
                "query_string": cl.get_query_string({self.lookup_kwarg: bit_mask}),
                "display": self.labels[number],
            }
