import os
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase


class EnsureAdminUserTests(TestCase):
    def test_creates_once_and_does_not_reset_existing_password(self):
        username = "splitmate-admin"
        initial_password = "initial-test-password"
        env = {
            "DJANGO_BOOTSTRAP_ADMIN_USERNAME": username,
            "DJANGO_BOOTSTRAP_ADMIN_PASSWORD": initial_password,
        }

        with patch.dict(os.environ, env):
            call_command("ensure_admin_user")

        user_model = get_user_model()
        admin = user_model.objects.get(username=username)
        self.assertTrue(admin.is_superuser)
        self.assertTrue(admin.check_password(initial_password))

        with patch.dict(
            os.environ,
            {
                "DJANGO_BOOTSTRAP_ADMIN_USERNAME": username,
                "DJANGO_BOOTSTRAP_ADMIN_PASSWORD": "updated-test-password",
            },
        ):
            call_command("ensure_admin_user")

        admin.refresh_from_db()
        self.assertTrue(admin.check_password(initial_password))

    def test_does_not_promote_an_existing_regular_user(self):
        username = "splitmate-admin"
        user_model = get_user_model()
        user_model.objects.create_user(
            username=username,
            password="existing-test-password",
        )

        with patch.dict(
            os.environ,
            {
                "DJANGO_BOOTSTRAP_ADMIN_USERNAME": username,
                "DJANGO_BOOTSTRAP_ADMIN_PASSWORD": "bootstrap-test-password",
            },
        ):
            with self.assertRaises(CommandError):
                call_command("ensure_admin_user")
