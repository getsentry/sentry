"""
Initial migration for billing app.
"""

from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="BillingSubscription",
            fields=[
                (
                    "id",
                    models.BigAutoField(primary_key=True, serialize=False),
                ),
                (
                    "organization_id",
                    models.BigIntegerField(db_index=True),
                ),
                (
                    "plan",
                    models.CharField(max_length=100),
                ),
                (
                    "billing_period_end",
                    models.DateTimeField(),
                ),
                (
                    "cancel_at_period_end",
                    models.BooleanField(default=False),
                ),
                (
                    "quantity",
                    models.IntegerField(default=1),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True),
                ),
                (
                    "stripe_subscription_id",
                    models.CharField(max_length=255, null=True, unique=True),
                ),
            ],
            options={
                "db_table": "billing_subscription",
            },
        ),
        migrations.AddIndex(
            model_name="billingsubscription",
            index=models.Index(fields=["organization_id"], name="billing_su_organiz_idx"),
        ),
        migrations.AddIndex(
            model_name="billingsubscription",
            index=models.Index(
                fields=["plan", "billing_period_end"], name="billing_su_plan_billing_idx"
            ),
        ),
    ]
