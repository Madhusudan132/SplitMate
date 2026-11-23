import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Create the configured Django superuser if it does not exist."

    def handle(self, *args, **options):
        username = os.getenv("DJANGO_BOOTSTRAP_ADMIN_USERNAME")
        password = os.getenv("DJANGO_BOOTSTRAP_ADMIN_PASSWORD")
        email = os.getenv("DJANGO_BOOTSTRAP_ADMIN_EMAIL", "")

        if not username or not password:
            raise CommandError(
                "Set DJANGO_BOOTSTRAP_ADMIN_USERNAME and "
                "DJANGO_BOOTSTRAP_ADMIN_PASSWORD."
            )

        user_model = get_user_model()
        username_field = user_model.USERNAME_FIELD
        lookup = {username_field: username}

        try:
            user = user_model._default_manager.get(**lookup)
        except user_model.DoesNotExist:
            user_fields = {
                **lookup,
                "password": password,
            }
            email_field = user_model.get_email_field_name()
            if email_field != username_field:
                user_fields[email_field] = email

            user_model._default_manager.create_superuser(**user_fields)
            self.stdout.write(
                self.style.SUCCESS("Bootstrap admin created.")
            )
            return

        if not user.is_superuser:
            raise CommandError(
                "The configured admin username already exists but is not "
                "a superuser. Choose a different username."
            )

        self.stdout.write("Bootstrap admin already exists; unchanged.")
