#!/usr/bin/env python
"""
Script to generate text versions (body.txt) of email templates from HTML versions (body.html).

This script converts HTML email templates to text format, preserving Django template
tags and maintaining the structure of the content. It can optionally use djlint to
check for and fix formatting issues in both the HTML source and generated text files.

Features:
- Preserves Django template tags ({% %}, {{ }}, {# #})
- Converts HTML formatting to Markdown-style text
- Replaces include paths from .html to .txt
- Fixes common template formatting issues
- Optionally checks/fixes templates with djlint
- Substitutes specific template tags for text-specific versions

Usage:
    python bin/generate_email_text.py --html path/to/template.html
    python bin/generate_email_text.py --html path/to/template.html --fix-html --fix-text
    python bin/generate_email_text.py --html path/to/template.html --all

Dependencies and setup:
    devenv sync
    source .venv/bin/activate
    pip install html2text djlint
"""

import argparse
import logging
import os
import re
import subprocess
import sys

from html2text import HTML2Text

# Define tag substitutions for HTML to text conversion
# These tags will be replaced when converting from HTML to text templates
TAG_SUBSTITUTIONS = {
    "spend_visibility_billing_usage_table": "spend_visibility_billing_usage_table_text",
    # Add more substitutions here as needed
}

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def extract_django_tags(text):
    """Extract Django template tags from text.

    This function identifies and extracts all Django template tags in a given text.
    Tags include:
    - Block tags: {% ... %}
    - Variable tags: {{ ... }}
    - Comment tags: {# ... #}

    Args:
        text (str): The template text to search for Django tags

    Returns:
        iterator: An iterator of re.Match objects containing the positions and content
                 of each Django tag found in the text
    """
    return re.finditer(r"({%.*?%}|{{.*?}}|{#.*?#})", text, re.DOTALL)


def process_with_djlint(file_path, check=False, fix=False, file_type="html"):
    """Process a file with djlint to check for issues and/or fix them.

    djlint is a linter/formatter for Django/Jinja templates that can identify
    common formatting issues and fix them automatically.

    Args:
        file_path (str): Path to the file to process
        check (bool): Whether to check the file for issues
        fix (bool): Whether to fix issues in the file
        file_type (str): Type of file being processed ('html' or 'text')

    Returns:
        bool: True if no issues found or fixes applied successfully,
              False if issues found and not fixed
    """
    if not check and not fix:
        return True

    file_type_display = "HTML" if file_type == "html" else "Text"

    def _run_djlint_command(cmd, description, check_mode=True):
        """Helper function to run djlint commands and handle output consistently.

        Args:
            cmd (list): Command to run
            description (str): Description of what the command does
            check_mode (bool): Whether to use check=True in subprocess.run

        Returns:
            tuple: (success, result) - success is boolean, result is subprocess result
        """
        logger.info("Running command: %s", " ".join(cmd))
        try:
            result = subprocess.run(
                cmd, check=check_mode, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
            )
            return True, result
        except subprocess.CalledProcessError as e:
            if check_mode:
                logger.debug("Command stderr: %s", e.stderr)
                logger.debug("Command stdout: %s", e.stdout)
                logger.debug("Command exit code: %d", e.returncode)
                return False, e
            return False, e

    # Handle text files differently since djlint may have issues with them
    if file_type == "text" and fix:
        # Read file content before processing to detect actual changes
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content_before = f.read()
        except OSError as e:
            logger.warning("Error reading file before formatting: %s", str(e))
            return False

        logger.info("Running djlint on text file: %s", file_path)

        # Run djlint without using check=True since we expect exit code 1 for text files
        success, result = _run_djlint_command(
            ["djlint", "--reformat", "--profile=django", file_path],
            "format text file",
            check_mode=False,
        )

        # Log output at debug level to hide diff
        if result.stdout:
            logger.debug(result.stdout)
        if result.stderr:
            logger.debug(result.stderr)

        # Check if file content actually changed
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content_after = f.read()
        except OSError as e:
            logger.warning("Error reading file after formatting: %s", str(e))
            return False

        actually_changed = content_before != content_after

        # Interpret djlint exit codes for text files
        if result.returncode == 0:
            logger.info(
                "djlint completed successfully (exit code: 0) - No formatting issues found in %s",
                file_path,
            )
            return True
        elif result.returncode == 1:
            if actually_changed:
                logger.info(
                    "djlint completed with exit code 1 - The file needed formatting and was updated"
                )
                logger.info("Fixed formatting in %s", file_path)
            else:
                logger.info(
                    "djlint completed with exit code 1 - The file needed formatting but no actual changes were made"
                )
                logger.info("No actual changes made to %s (formatting already correct)", file_path)
            return True
        else:
            logger.warning(
                "djlint encountered an error (exit code: %d) with %s",
                result.returncode,
                file_path,
            )
            return False

    # Handle HTML files or check-only operations
    if fix:
        success, result = _run_djlint_command(
            ["djlint", file_path, "--reformat", "--profile=django"],
            f"reformat {file_type_display} file",
        )

        if success:
            logger.info(
                "djlint completed successfully - Formatting fixed in %s file: %s",
                file_type_display,
                file_path,
            )
        else:
            logger.error(
                "djlint failed with exit code %d - Failed to fix %s issues in %s",
                result.returncode,
                file_type_display,
                file_path,
            )

    if check:
        success, result = _run_djlint_command(
            ["djlint", file_path, "--check", "--profile=django"], f"check {file_type_display} file"
        )

        if success:
            logger.info(
                "djlint check completed successfully (exit code: 0) - No %s issues found in %s",
                file_type_display,
                file_path,
            )
        else:
            logger.warning(
                "djlint check failed with exit code %d - Found %s issues in %s",
                result.returncode,
                file_type_display,
                file_path,
            )
            return False

    return True


def convert_html_to_text(html):
    """Convert HTML to plain text while preserving Django template tags.

    This function converts HTML markup to plain text with Markdown-like formatting
    while ensuring that Django template tags remain intact and functional.

    The conversion process:
    1. Replaces Django tags with unique placeholders
    2. Converts HTML to text using html2text
    3. Restores the original Django tags from placeholders
    4. Adds newlines between adjacent links for better readability
    5. Cleans up formatting issues in the text

    Args:
        html (str): HTML content with Django tags to convert

    Returns:
        str: Text version of the HTML with Django tags preserved
    """
    # First, replace Django tags with placeholders
    tags = list(extract_django_tags(html))
    placeholders = {}

    modified_html = html
    offset = 0

    for match in tags:
        start, end = match.span()
        tag = match.group()
        placeholder = f"__DJANGO_TAG_{len(placeholders)}__"
        placeholders[placeholder] = tag

        adjusted_start = start + offset
        adjusted_end = end + offset
        modified_html = modified_html[:adjusted_start] + placeholder + modified_html[adjusted_end:]
        offset += len(placeholder) - (end - start)

    # Configure html2text options
    h = HTML2Text()
    h.body_width = 0  # Don't wrap lines
    h.ignore_links = False  # Keep links as text
    h.ignore_images = True  # Skip image placeholders
    h.ignore_tables = False  # Preserve table structure
    h.unicode_snob = True  # Use Unicode characters instead of ASCII
    h.ignore_emphasis = True  # Don't convert * to ** in text

    # Convert to plain text
    text = h.handle(modified_html)

    # Restore Django tags
    for placeholder, tag in placeholders.items():
        text = text.replace(placeholder, tag)

    # Improve handling of links with better spacing
    # 1. Standard markdown links pattern: [text](url) [text2](url2)
    text = re.sub(r"(\]\([^)]+\)) (\[[^\]]+\])", r"\1\n\n\2", text)

    # 2. Links with Django template tags between them
    text = re.sub(
        r"(\]\([^)]+\))(.*?)(\[[^\]]+\])",
        lambda m: (
            m.group(1) + "\n\n" + m.group(2) + m.group(3)
            if not re.search(r"\n", m.group(2))
            else m.group(0)
        ),
        text,
    )

    # 3. Special case: handle links at the end of a line followed by links at start of next line
    text = re.sub(r"(\]\([^)]+\))\n(\[[^\]]+\])", r"\1\n\n\2", text)

    # 4. Add newlines between links in direct sequence (no space between closing ] and opening [)
    text = re.sub(r"(\]\([^)]+\))(\[[^\]]+\])", r"\1\n\n\2", text)

    # 5. Handle template tag URLs: [text]({% tag %}) [text2](url2)
    text = re.sub(r"(\]\([^)]+\)) (\[[^\]]+\])", r"\1\n\n\2", text)

    # 6. Additional spacing after a link followed by text
    text = re.sub(
        r"(\]\([^)]+\))([^\[\n])",
        lambda m: m.group(1) + "\n\n" + m.group(2) if not m.group(2).isspace() else m.group(0),
        text,
    )

    # Clean up some common formatting issues
    text = re.sub(r"\n\s*\n", "\n\n", text)  # Remove extra blank lines
    text = re.sub(r" +", " ", text)  # Remove repeated spaces

    # Final clean up: ensure we don't have more than two consecutive newlines
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text


def remove_block_tags(text):
    """Remove block tags from the text template while preserving their content.

    This function extracts the content from within block tags and places it directly
    in the text, removing the block directives themselves. This makes the text template
    more readable and direct, without the need for block inheritance.

    Args:
        text (str): Text with Django block tags to process

    Returns:
        str: Text with block tags removed but their content preserved
    """
    # Define a pattern to match block tags and their content
    block_pattern = r"{%\s*block\s+([^%]*?)\s*%}(.*?){%\s*endblock\s*(?:[^%]*?)\s*%}"

    # Find all block tags and their content in the text
    blocks = re.finditer(block_pattern, text, re.DOTALL)

    # Make a copy of the text to modify
    modified_text = text

    # Process each block, replacing the entire block (including tags) with just its content
    offset = 0
    for match in blocks:
        block_name = match.group(1).strip()
        block_content = match.group(2)

        # Log the block being processed
        logger.debug("Processing block: %s", block_name)

        # Get the span of the entire block including tags
        start, end = match.span()
        adjusted_start = start + offset
        adjusted_end = end + offset

        # Replace the entire block with just its content in the text
        modified_text = (
            modified_text[:adjusted_start] + block_content.strip() + modified_text[adjusted_end:]
        )

        # Update offset for subsequent replacements
        original_length = end - start
        replacement_length = len(block_content.strip())
        offset += replacement_length - original_length

    # Clean up formatting issues that might have been introduced
    modified_text = re.sub(r"\n\s*\n\s*\n", "\n\n", modified_text)  # Remove triple newlines

    return modified_text


def remove_block_super(text):
    """Remove {{ block.super }} occurrences from text templates.

    Since we're removing the block structure, {{ block.super }} references
    (which include content from parent template blocks) are no longer relevant.

    Args:
        text (str): Text with potential {{ block.super }} references

    Returns:
        str: Text with {{ block.super }} references removed
    """
    # Define pattern to match {{ block.super }} with potential whitespace variations
    super_pattern = r"{{\s*block\.super\s*}}"

    # Remove block.super occurrences
    modified_text = re.sub(super_pattern, "", text)

    # Clean up any blank lines that might have been created by the removal
    modified_text = re.sub(r"\n\s*\n\s*\n", "\n\n", modified_text)

    return modified_text


def substitute_template_tags(text):
    """Substitute specific template tags with their text-appropriate versions.

    This function replaces template tags according to the TAG_SUBSTITUTIONS dictionary,
    which defines mappings from HTML template tags to their text-specific equivalents.

    Args:
        text (str): Template text containing Django tags to substitute

    Returns:
        str: Text with template tags substituted according to TAG_SUBSTITUTIONS
    """
    # Skip if no substitutions defined
    if not TAG_SUBSTITUTIONS:
        return text

    modified_text = text

    # Process each tag substitution
    for html_tag, text_tag in TAG_SUBSTITUTIONS.items():
        # Create a pattern that matches the tag in template syntax: {% tag ... %}
        # This captures any parameters that might be part of the tag
        pattern = r"{%\s*" + re.escape(html_tag) + r"\s+([^%]*?)%}"
        replacement = r"{% " + text_tag + r" \1%}"

        # Replace all occurrences of the tag
        modified_text = re.sub(pattern, replacement, modified_text)

        logger.debug("Replaced template tag '%s' with '%s'", html_tag, text_tag)

    return modified_text


def add_linebreaks_after_tags(text):
    """Add line breaks after template tags to improve readability.

    This function ensures that certain template tags (like include) are followed
    by a line break for better formatting and readability of text templates.

    Args:
        text (str): Text with Django template tags

    Returns:
        str: Text with added line breaks after specified template tags
    """
    # Tags that should be followed by a line break
    tags_needing_breaks = ["include", "load", "if", "else", "endif", "for", "endfor"]

    # Create a pattern that matches tags that need line breaks
    # The pattern captures the tag and any whitespace/newline after it
    pattern = r"({%\s*(?:" + "|".join(tags_needing_breaks) + r").*?%})(\s*)"

    # Replace matched tags, ensuring they're followed by at least one newline
    def add_break(match):
        tag = match.group(1)
        whitespace = match.group(2)

        # If no newline after tag, add one
        if not whitespace or "\n" not in whitespace:
            return tag + "\n"
        # If already has newline, keep as is
        return tag + whitespace

    modified_text = re.sub(pattern, add_break, text)

    # Ensure there aren't excessive newlines (no more than 2 consecutive)
    modified_text = re.sub(r"\n{3,}", "\n\n", modified_text)

    return modified_text


def generate_text_template(
    html_path, text_path=None, check_html=False, fix_html=False, check_text=False, fix_text=False
):
    """Generate a text template from an HTML template.

    This is the main function that processes an HTML template and generates a text version.
    The function can optionally check/fix both the HTML source and text output with djlint.

    The process:
    1. Optionally processes the HTML with djlint
    2. Reads the HTML content
    3. Extracts load tags for preservation
    4. Converts HTML to text preserving templates
    5. Removes extends tags as they're handled differently in text
    6. Adds load tags at the beginning if not already present
    7. Updates include paths to reference .txt files instead of .html
    8. Removes block tags while preserving their content
    9. Removes {{ block.super }} references
    10. Substitutes template tags according to TAG_SUBSTITUTIONS
    11. Adds line breaks after specific template tags
    12. Writes the text content to the output file
    13. Optionally processes the text output with djlint

    Args:
        html_path (str): Path to the HTML template
        text_path (str, optional): Path for the output text template.
                                   Defaults to same path with .html replaced by .txt
        check_html (bool): Whether to check HTML for issues with djlint
        fix_html (bool): Whether to fix HTML issues with djlint
        check_text (bool): Whether to check generated text for issues with djlint
        fix_text (bool): Whether to fix issues in generated text files using djlint

    Returns:
        str: Path to the generated text template
    """
    if text_path is None:
        text_path = html_path.replace(".html", ".txt")

    # Ensure the output directory exists
    output_dir = os.path.dirname(text_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Process HTML with djlint if requested
    process_with_djlint(html_path, check=check_html, fix=fix_html, file_type="html")

    try:
        with open(html_path, "r", encoding="utf-8") as f:
            html = f.read()
    except OSError:
        logger.exception("Error reading HTML file %s", html_path)
        sys.exit(1)

    # Extract load tags from the HTML template
    load_tags = re.findall(r"{%\s*load\s+[^%]*%}", html)
    load_tags_str = "\n".join(load_tags)

    # Convert HTML to text
    text = convert_html_to_text(html)

    # Remove extends tag (handled differently in text templates)
    text = re.sub(r"{%\s*extends\s+[^%]*%}", "", text)

    # Check if load tags already exist in the text
    # If they do, don't add them again to avoid duplication
    load_tags_exist = any(re.search(re.escape(tag), text) for tag in load_tags)

    # Add load tags at the beginning only if they don't already exist
    if load_tags and not load_tags_exist:
        text = load_tags_str + "\n\n" + text

    # Replace any include tags that reference HTML with text
    text = re.sub(r'({%\s*include\s+"[^"]*).html([^%]*%})', r"\1.txt\2", text)
    text = re.sub(
        r"({%\s*include\s+'[^']*).html([^%]*%})", r"\1.txt\2", text
    )  # Handle single quotes too

    # Remove block tags while preserving their content
    text = remove_block_tags(text)

    # Remove {{ block.super }} references
    text = remove_block_super(text)

    # Substitute template tags according to TAG_SUBSTITUTIONS
    text = substitute_template_tags(text)

    # Add line breaks after specific template tags
    text = add_linebreaks_after_tags(text)

    # Write the text to the output file and ensure it's fully written
    try:
        with open(text_path, "w", encoding="utf-8") as f:
            f.write(text)
            # Explicitly flush to disk
            f.flush()
            os.fsync(f.fileno())
    except OSError:
        logger.exception("Error writing text file %s", text_path)
        sys.exit(1)

    # Process the generated text file with djlint if requested
    if check_text or fix_text:
        process_with_djlint(text_path, check=check_text, fix=fix_text, file_type="text")

    return text_path


def main():
    """Main entry point for the script.

    Parses command-line arguments and runs the template conversion process.
    """
    parser = argparse.ArgumentParser(
        description="Generate text email templates from HTML templates.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate text version of a single template
  python generate_email_text.py --html templates/email/welcome.html

  # Check and fix issues in HTML, then generate text
  python generate_email_text.py --html templates/email/welcome.html --check-html --fix-html

  # Process all templates matching the base name pattern
  python generate_email_text.py --html templates/email/welcome.html --all

  # Fix HTML and text formatting issues
  python generate_email_text.py --html templates/email/welcome.html --fix-html --fix-text
""",
    )
    parser.add_argument("--html", required=True, help="Path to the HTML template")
    parser.add_argument(
        "--text", help="Path to write the text template (defaults to same name with .txt extension)"
    )
    parser.add_argument(
        "--all", action="store_true", help="Process all matching templates in the directory"
    )
    parser.add_argument(
        "--check-html", action="store_true", help="Check HTML files for issues using djlint"
    )
    parser.add_argument(
        "--fix-html", action="store_true", help="Fix HTML issues using djlint before conversion"
    )
    parser.add_argument(
        "--check-text",
        action="store_true",
        help="Check generated text files for issues using djlint",
    )
    parser.add_argument(
        "--fix-text", action="store_true", help="Fix issues in generated text files using djlint"
    )

    args = parser.parse_args()

    if args.all:
        # Find all HTML templates in the directory
        directory = os.path.dirname(args.html)
        base_name = os.path.basename(args.html).replace(".html", "")

        for root, _, files in os.walk(directory):
            for file in files:
                if file.endswith(".html") and base_name in file:
                    html_path = os.path.join(root, file)
                    text_path = html_path.replace(".html", ".txt")
                    generate_text_template(
                        html_path,
                        text_path,
                        args.check_html,
                        args.fix_html,
                        args.check_text,
                        args.fix_text,
                    )
                    logger.info("Generated %s", text_path)
    else:
        text_path = generate_text_template(
            args.html, args.text, args.check_html, args.fix_html, args.check_text, args.fix_text
        )
        logger.info("Generated %s", text_path)


if __name__ == "__main__":
    main()
