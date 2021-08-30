from django.contrib.auth.models import AbstractBaseUser
from django.db import models


class EmailUser(AbstractBaseUser):
    email = models.CharField(max_length=254, unique=True)

    USERNAME_FIELD = "email"

    def get_username(self):
        return self.email

    class Meta:
        app_label = "sudo_tests"
