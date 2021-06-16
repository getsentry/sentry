from django.conf.urls import url

from sudo import views

urlpatterns = [
    url(r"^sudo/", views.sudo, name="sudo"),
]
