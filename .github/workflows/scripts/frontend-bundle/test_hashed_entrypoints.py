import json

from hashed_entrypoints import main


def test_hashed_entrypoints(tmp_path) -> None:
    input_dir = tmp_path.joinpath("inputs")
    output_dir = tmp_path.joinpath("outputs")
    cfgmap = tmp_path.joinpath("cfg")

    input_dir.mkdir()
    input_dir.joinpath("f1.js").write_text("// hi")
    input_dir.joinpath("f1.js.gz").write_bytes(b"\xde\xad")
    input_dir.joinpath("f2.css").write_text("/* hello */")
    input_dir.joinpath("f2.css.gz").write_bytes(b"\xbe\xef")

    args = (f"--src={input_dir}", f"--dest={output_dir}", f"--cfg={cfgmap}", "--sha=abc123def456")
    assert main(args) == 0

    for fname, contents in (
        ("f1-6H8vtLs_DLFqRGnsJwidlPQMvAksyo8GLGjUoehPlBc.js", b"// hi"),
        ("f1-6H8vtLs_DLFqRGnsJwidlPQMvAksyo8GLGjUoehPlBc.js.gz", b"\xde\xad"),
        ("f2-LlxUu4yXLJj66mfreDPVMRj7rvqtnrQYNPmpxgUqZvA.css", b"/* hello */"),
        ("f2-LlxUu4yXLJj66mfreDPVMRj7rvqtnrQYNPmpxgUqZvA.css.gz", b"\xbe\xef"),
    ):
        assert output_dir.joinpath(fname).read_bytes() == contents

    contents = json.loads(cfgmap.read_text())
    assert contents == {
        "entrypoints": {
            "f1.js": "f1-6H8vtLs_DLFqRGnsJwidlPQMvAksyo8GLGjUoehPlBc.js",
            "f2.css": "f2-LlxUu4yXLJj66mfreDPVMRj7rvqtnrQYNPmpxgUqZvA.css",
        },
        "commit_sha": "abc123def456",
    }
