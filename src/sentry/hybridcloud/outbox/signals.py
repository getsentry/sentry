from django.dispatch import Signal

process_region_outbox = Signal()  # ["payload", "object_identifier"]
process_control_outbox = Signal()  # ["payload", "region_name", "object_identifier"]
