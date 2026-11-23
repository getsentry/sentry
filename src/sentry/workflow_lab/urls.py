from django.urls import path, re_path

from . import views
from .editor import EditorEndpoint

urlpatterns = [
    path("<slug:organization_id_or_slug>/", views.page, name="workflow-lab"),
    path("<slug:organization_id_or_slug>/notebook/", views.page, {"notebook": True}),
    path("<slug:organization_id_or_slug>/editor/", EditorEndpoint.as_view()),
    re_path(
        r"^(?P<organization_id_or_slug>[\w-]+)/assets/(?P<name>(?:vendor/)?[\w-]+(?:\.min)?\.(?:css|js))$",
        views.asset,
    ),
]
