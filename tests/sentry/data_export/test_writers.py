from io import BytesIO

from sentry.data_export.writers import FileWriter, OutputMode


def test_csv_writerow_escapes_formula_strings() -> None:
    buffer = BytesIO()
    writer = FileWriter(buffer, OutputMode.CSV, csv_headers=["tag", "count"])

    writer.writerow({"tag": "=1+1", "count": -5})

    assert buffer.getvalue() == b"'=1+1,-5\r\n"


def test_csv_writeheader_escapes_formula_headers() -> None:
    buffer = BytesIO()
    writer = FileWriter(buffer, OutputMode.CSV, csv_headers=["=1+1", "count"])

    writer.writeheader()

    assert buffer.getvalue() == b"'=1+1,count\r\n"


def test_jsonl_writerow_does_not_escape() -> None:
    buffer = BytesIO()
    writer = FileWriter(buffer, OutputMode.JSONL)

    writer.writerow({"tag": "=1+1"})

    assert buffer.getvalue() == b'{"tag":"=1+1"}\n'
