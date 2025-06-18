from collections.abc import Mapping, Sequence
from dataclasses import dataclass

from rest_framework.exceptions import ValidationError


@dataclass(frozen=True)
class SortByParam:
    """
    SortByParam assists in parsing a 'sortBy' parameter from the request,
    validating it against an endpoint-specific config, and providing the
    values that should be passed along to QuerySet.order_by and the Paginator.
    To guarantee stable results with potentially duplicated sort keys, 'id' is
    used as a fallback sort key.

    The parameter is expected to be in the format of "[-]<field_name>", where
    the optional "-" prefix indicates descending order and the field_name
    must be a key in the provided mapping.
    """

    "The sort keys that should be passed to the QuerySet order_by method."
    db_order_by: Sequence[str]
    "The name of the database field we should use to sort the queryset."
    db_field_name: str

    @staticmethod
    def parse(sort_by: str, api_to_db_map: Mapping[str, str]) -> "SortByParam":
        """
        Parse the 'sortBy' parameter from the request, raising a ValidationError if the
        field is invalid.

        api_to_db_map is a mapping from the API field name to the database field name
        to be used for sorting.
        """
        order_prefix = "-" if sort_by.startswith("-") else ""
        sort_field = sort_by[len(order_prefix) :]
        if sort_field not in api_to_db_map:
            raise ValidationError({"sortBy": ["Invalid sort field"]})
        db_field_name = api_to_db_map[sort_field]
        field_order_by = order_prefix + db_field_name
        if db_field_name == "id":
            return SortByParam((field_order_by,), db_field_name)
        else:
            return SortByParam((field_order_by, order_prefix + "id"), db_field_name)
