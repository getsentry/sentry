from django.urls import include, path, re_path

from . import views
from .editor import EditorEndpoint

urlpatterns = [
    re_path(
        r"^(?P<organization_id_or_slug>[^/]+)/",
        include(
            [
                path("", views.page, name="workflow-lab"),
                path("notebook/", views.page, {"notebook": True}, name="workflow-lab-notebook"),
                path("editor/", EditorEndpoint.as_view(), name="workflow-lab-editor"),
                re_path(
                    r"^assets/(?P<name>(?:vendor/)?[\w-]+(?:\.min)?\.(?:css|js))$",
                    views.asset,
                    name="workflow-lab-asset",
                ),
            ]
        ),
    )
]
