from typing import Any

from django.db.models import Exists, OuterRef, Q, QuerySet, TextField
from django.db.models.functions import Cast
from drf_spectacular.utils import OpenApiParameter
from rest_framework.request import Request

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist, UserRequired
from sentry.apidocs.parameters import CursorQueryParam
from sentry.auth.principal import has_user
from sentry.notebooks.access import filter_visible_notebooks
from sentry.notebooks.models import Notebook, NotebookSourceType
from sentry.notifications.models.inboxitem import InboxItem

PAGINATION_PARAMETERS = [
    CursorQueryParam,
    OpenApiParameter(
        "per_page", int, description="Results per page, from 1 to 100. Defaults to 25."
    ),
]


class OrganizationInboxEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ISSUES
    requires_user = True

    def filter_visible_items(
        self, items: QuerySet[InboxItem], request: Request
    ) -> QuerySet[InboxItem]:
        """Hide protected monitor investigations before counts, pagination or event reads.

        Other subject types and deleted subjects retain their existing inbox behavior.
        """
        hidden_notebooks = (
            Notebook.objects.filter(source_type=NotebookSourceType.METRIC_OPEN_PERIOD)
            .exclude(id__in=filter_visible_notebooks(Notebook.objects.all(), request.access))
            .annotate(notebook_id_text=Cast("id", TextField()))
            .filter(notebook_id_text=OuterRef("subject_id"))
        )
        return items.filter(~Q(subject_type="notebook") | ~Q(Exists(hidden_notebooks)))

    def convert_args(
        self, request: Request, *args: Any, **kwargs: Any
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, *args, **kwargs)
        if not features.has(
            "organizations:universal-inbox", kwargs["organization"], actor=request.user
        ):
            raise ResourceDoesNotExist
        if not has_user(request.user):
            raise UserRequired
        return args, kwargs
