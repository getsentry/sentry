#!/usr/bin/env python3
"""
Final comprehensive analysis of styled(Button) and styled(LinkButton) for width-expanding rules.
"""

import re
import os
from pathlib import Path
from collections import defaultdict

# Patterns that indicate width expansion (not fixed units)
WIDTH_EXPAND_PATTERNS = {
    'width_100_percent': r'(?<!max-)width:\s*["\']?100%["\']?',  # width: 100% but NOT max-width
    'width_100_percent_template': r'(?<!max-)width:\s*\${[^}]*100%[^}]*}',  # template with 100%
    'flex_1': r'flex:\s*1(?:\s|;|,|})',  # flex: 1
    'flex_grow_1': r'flex-grow:\s*1(?:\s|;|,|})',  # flex-grow: 1
    'width_calc': r'width:\s*calc\([^)]*\)',  # width: calc(...)
    'width_100vw': r'width:\s*100vw',  # width: 100vw
    'width_inherit': r'width:\s*inherit',  # width: inherit
    'flex_auto': r'flex:\s*auto',  # flex: auto
    'align_self_stretch': r'align-self:\s*stretch',  # align-self: stretch (stretches in cross-axis)
}

# Patterns to exclude (fixed units or limiting)
EXCLUDE_PATTERNS = [
    r'width:\s*\d+px',  # Fixed pixels
    r'width:\s*\d+rem',  # Fixed rem
    r'width:\s*\d+em',  # Fixed em
    r'width:\s*\d+ch',  # Fixed ch
    r'max-width:\s*\d+',  # Max width limits expansion
]

def find_styled_buttons_comprehensive(directory):
    """Find all files with styled(Button) or styled(LinkButton) using multiple methods."""
    static_dir = Path(directory) / 'static'
    all_files = set()
    
    # Method 1: Using rg for styled(Button)
    try:
        cmd = f'rg -l "styled\\((Button|LinkButton)\\)" {static_dir}'
        output = os.popen(cmd).read().strip()
        if output:
            files = output.split('\n')
            all_files.update(f for f in files if f)
    except:
        pass
    
    # Method 2: Search for common button styling patterns
    try:
        cmd = f'rg -l "const\\s+\\w+\\s*=\\s*styled\\(.*Button" {static_dir}'
        output = os.popen(cmd).read().strip()
        if output:
            files = output.split('\n')
            all_files.update(f for f in files if f)
    except:
        pass
    
    return sorted([f for f in all_files if f and os.path.exists(f)])

def extract_styled_components_comprehensive(content, filename):
    """Extract styled component definitions from file content - comprehensive."""
    results = []
    
    # Pattern 1: Standard template literal
    pattern1 = r'const\s+(\w+)\s*=\s*styled\((Button|LinkButton)\)(<[^>]*>)?`([^`]*)`'
    
    # Pattern 2: With props type annotation
    pattern2 = r'const\s+(\w+)\s*=\s*styled\((Button|LinkButton)\)<[^>]+>`([^`]*)`'
    
    patterns_to_try = [
        (pattern1, 4),  # CSS is in group 4
        (pattern2, 3),  # CSS is in group 3
    ]
    
    for pattern, css_group in patterns_to_try:
        for match in re.finditer(pattern, content, re.MULTILINE | re.DOTALL):
            component_name = match.group(1)
            button_type = match.group(2)
            css_content = match.group(css_group)
            start_pos = match.start()
            
            # Calculate line number
            line_num = content[:start_pos].count('\n') + 1
            
            # Find the actual line and column
            lines = content[:start_pos].split('\n')
            col_num = len(lines[-1]) + 1 if lines else 1
            
            # Check for width-expanding patterns in CSS
            matched_patterns = []
            
            for pattern_name, pattern_str in WIDTH_EXPAND_PATTERNS.items():
                if re.search(pattern_str, css_content, re.IGNORECASE):
                    matched_patterns.append(pattern_name)
            
            # Check if it should be excluded (fixed units)
            should_exclude = False
            for exclude_pattern in EXCLUDE_PATTERNS:
                if re.search(exclude_pattern, css_content, re.IGNORECASE):
                    should_exclude = True
                    break
            
            if matched_patterns and not should_exclude:
                results.append({
                    'file': filename,
                    'line': line_num,
                    'column': col_num,
                    'component_name': component_name,
                    'button_type': button_type,
                    'css': css_content.strip(),
                    'patterns': matched_patterns
                })
    
    return results

def main():
    workspace = '/workspace'
    
    print("=" * 80)
    print("FINAL STYLED BUTTON WIDTH EXPANSION ANALYSIS")
    print("=" * 80)
    print()
    print("Finding files with styled(Button) and styled(LinkButton)...")
    files = find_styled_buttons_comprehensive(workspace)
    print(f"Found {len(files)} files to analyze\n")
    
    all_results = []
    pattern_counts = defaultdict(int)
    
    for filepath in files:
        if not filepath or not os.path.exists(filepath):
            continue
            
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            results = extract_styled_components_comprehensive(content, filepath)
            all_results.extend(results)
            
            for result in results:
                for pattern in result['patterns']:
                    pattern_counts[pattern] += 1
                    
        except Exception as e:
            print(f"Error processing {filepath}: {e}")
    
    # Remove duplicates by file:line:col
    unique_results = []
    seen = set()
    for result in all_results:
        key = (result['file'], result['line'], result['column'])
        if key not in seen:
            seen.add(key)
            unique_results.append(result)
    
    # Sort by file path
    unique_results.sort(key=lambda x: (x['file'], x['line']))
    
    print(f"Found {len(unique_results)} instances of styled(Button)/styled(LinkButton)")
    print("with width-expanding rules\n")
    
    print("Pattern Distribution:")
    for pattern_name, count in sorted(pattern_counts.items(), key=lambda x: -x[1]):
        print(f"  {pattern_name}: {count}")
    print()
    
    # Write comprehensive report
    output_file = '/workspace/STYLED_BUTTON_WIDTH_ANALYSIS.md'
    with open(output_file, 'w') as f:
        f.write("# Styled Button Width Expansion Analysis\n\n")
        f.write("**Analysis Date:** February 5, 2026\n\n")
        f.write("## Summary\n\n")
        f.write(f"This report identifies all instances of `styled(Button)` and `styled(LinkButton)` ")
        f.write(f"in the Sentry codebase that have styling rules causing the button width to expand ")
        f.write(f"and fill the surrounding white space.\n\n")
        f.write(f"**Total instances found:** {len(unique_results)}\n\n")
        
        f.write("## Pattern Distribution\n\n")
        f.write("| Pattern | Count | Description |\n")
        f.write("|---------|-------|-------------|\n")
        
        pattern_descriptions = {
            'width_100_percent': 'Sets button width to 100% of parent',
            'flex_1': 'Makes button grow to fill available space (flex: 1)',
            'flex_grow_1': 'Allows button to grow (flex-grow: 1)',
            'align_self_stretch': 'Stretches button in cross-axis of flex/grid container',
            'width_calc': 'Uses calc() to compute width',
            'width_100vw': 'Sets width to 100% of viewport width',
            'width_inherit': 'Inherits width from parent',
            'flex_auto': 'Flexible sizing (flex: auto)',
        }
        
        for pattern_name, count in sorted(pattern_counts.items(), key=lambda x: -x[1]):
            desc = pattern_descriptions.get(pattern_name, 'Width expansion pattern')
            f.write(f"| `{pattern_name}` | {count} | {desc} |\n")
        
        f.write("\n## All Locations\n\n")
        f.write("### Format: `file:line:column`\n\n")
        
        for result in unique_results:
            relative_path = result['file'].replace('/workspace/', '')
            f.write(f"- `{relative_path}:{result['line']}:{result['column']}`\n")
        
        f.write("\n## Detailed Analysis\n\n")
        
        for i, result in enumerate(unique_results, 1):
            relative_path = result['file'].replace('/workspace/', '')
            f.write(f"### {i}. `{relative_path}`\n\n")
            f.write(f"**Location:** `{relative_path}:{result['line']}:{result['column']}`\n\n")
            f.write(f"**Component Name:** `{result['component_name']}`\n\n")
            f.write(f"**Type:** `styled({result['button_type']})`\n\n")
            f.write(f"**Matched Patterns:** `{', '.join(result['patterns'])}`\n\n")
            f.write(f"**CSS:**\n\n")
            f.write("```css\n")
            # Write CSS with proper formatting
            css_lines = result['css'].split('\n')
            for line in css_lines[:20]:  # Limit to 20 lines
                f.write(f"{line}\n")
            if len(css_lines) > 20:
                f.write(f"... ({len(css_lines) - 20} more lines)\n")
            f.write("```\n\n")
            f.write("---\n\n")
    
    print(f"Comprehensive report written to: {output_file}\n")
    
    # Write simple location list (requested format)
    list_file = '/workspace/button_width_locations_list.txt'
    with open(list_file, 'w') as f:
        f.write("# Locations of styled(Button) and styled(LinkButton) with width-expanding rules\n")
        f.write("# Excludes rules using fixed units like 100px, 200px, etc.\n")
        f.write("# Format: file:line:column\n\n")
        for result in unique_results:
            relative_path = result['file'].replace('/workspace/', '')
            f.write(f"{relative_path}:{result['line']}:{result['column']}\n")
    
    print(f"Simple location list written to: {list_file}\n")
    
    print("=" * 80)
    print("All Locations (file:line:column):")
    print("=" * 80)
    for result in unique_results:
        relative_path = result['file'].replace('/workspace/', '')
        print(f"{relative_path}:{result['line']}:{result['column']}")
    
    print()
    print("=" * 80)
    print(f"Analysis complete! Total: {len(unique_results)} locations")
    print("=" * 80)

if __name__ == '__main__':
    main()
