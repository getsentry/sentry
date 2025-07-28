from ast import Attribute, Call, ClassDef, Constant, FunctionDef, Name, expr, parse

PROGRESS_UPDATE_SIZE = 25

# Step 1: Get list of relevant files

# rg -ls "@(mock\.)?patch" > patchfiles.txt
patch_files_filename = "patchfiles.txt"
patch_files = set()
for line in open(patch_files_filename):
    line = line.strip()
    if len(line) > 0:
        patch_files.add(line)


def log(*args: str) -> None:
    # print(s)
    pass


def get_num_patches_from_decorator_list(dec_list: list[expr]) -> int:
    num_patch_decorators = 0
    for dec in dec_list:
        if isinstance(dec, Call):
            dec_fn = dec.func
            dec_builder = []
            while isinstance(dec_fn, Attribute):
                dec_builder.append(dec_fn.attr)
                dec_fn = dec_fn.value
            assert isinstance(dec_fn, Name)
            dec_builder.append(dec_fn.id)
            dec_str = ".".join(dec_builder[::-1])
            if dec_str in [
                "patch",
                "patch.object",
                "mock.patch",
                "mock.patch.object",
            ]:
                num_patch_decorators += 1
    return num_patch_decorators


def replace_for_function(
    fn_def: FunctionDef, import_from_mock: bool, is_in_class=False, num_known_patches=0
) -> tuple[str, str] | None:
    """
    Takes function def, returns pair of source.replace arguments or none
    e.g.
    '''
    @patch("foo.bar")
    def test_abc(self, mock_bar):
      pass
    '''

    ONLY IF:
    * fn_def.name starts in test_
    * fn_def.returns is None or isinstance(fn_def.returns, ast.Constant) and fn_def.returns.value == None
    * Num args is expected (maybe self and then expected # of patches)

    The benefit of passing replace args back is it should fail closed
    """
    if not fn_def.name.startswith("test"):
        return None

    if fn_def.returns is None:
        has_return = False
    elif not (isinstance(fn_def.returns, Constant) and fn_def.returns.value is None):
        return None
    else:
        has_return = True

    num_patch_decorators = get_num_patches_from_decorator_list(fn_def.decorator_list)
    num_mocked_args = num_known_patches + num_patch_decorators
    if num_mocked_args == 0:
        return None

    has_self = is_in_class and fn_def.args.args[0].arg == "self"
    expected_num_args = num_mocked_args + (1 if has_self else 0)
    num_args = len(fn_def.args.args)
    if expected_num_args != num_args:
        return None

    args = [arg.arg for arg in fn_def.args.args]
    if import_from_mock:
        mocktype = "MagicMock"
    else:
        mocktype = "mock.MagicMock"
    new_args = [arg + ": " + mocktype for arg in args]
    if has_self:
        new_args[0] = "self"

    old_str = "".join(
        [fn_def.name, "(", ", ".join(args), ")", (" -> None" if has_return else ""), ":"]
    )

    new_str = "".join([fn_def.name, "(", ", ".join(new_args), ")", " -> None:"])
    return (old_str, new_str)


def get_replacements_for_class(
    clazz: ClassDef,
    import_from_mock: bool,
) -> list[tuple[str, str]]:
    num_known_patches = get_num_patches_from_decorator_list(clazz.decorator_list)

    replacements = []
    for child in clazz.body:
        if isinstance(child, FunctionDef):
            maybe_replacement = replace_for_function(
                child, import_from_mock, True, num_known_patches
            )
            if maybe_replacement is not None:
                replacements.append(maybe_replacement)
    return replacements


# Step 2: Process each file
num_processed = 0
# Step 2a: Parse AST
for path in patch_files:
    source = open(path).read()
    ast = parse(source, path)

    if "from unittest.mock import" in source:
        import_from_mock = True
    elif "from unittest import " in source:
        import_from_mock = False
    else:
        assert False, "Unknown import situation in: " + path

    # Step 2b: Walk AST to find relevant @patch decorators on classes/functions
    children = ast.body
    any_changes = False
    all_changes = []
    for child in children:
        if isinstance(child, FunctionDef):
            changes = any_changes or replace_for_function(child, import_from_mock)
            if changes is not None:
                all_changes.append(changes)
        if isinstance(child, ClassDef):
            all_changes.extend(get_replacements_for_class(child, import_from_mock))

    # Step 2c: Apply replacement to the file
    has_any_change = False
    for old, new in all_changes:
        if old in source:
            source = source.replace(old, new)
            has_any_change = True

    if has_any_change and import_from_mock:
        # The commit hooks will deal with formatting anyways
        source = "from unittest.mock import MagicMock\n" + source

    open(path, "w").write(source)

    num_processed += 1
    if num_processed % PROGRESS_UPDATE_SIZE == 0:
        log("Processed:", str(num_processed))
