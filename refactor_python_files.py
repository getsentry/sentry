#!/usr/bin/env python3
"""
Script to refactor Python documentation files to use content arrays
instead of configurations/description structure
"""

import os
import re
from pathlib import Path

def refactor_install_section(content):
    """Refactor install sections to use content arrays"""
    pattern = r'(\s+)type: StepType\.INSTALL,\n\s+description: (.*?),\n\s+configurations: getPythonInstallConfig\((.*?)\),\n\s+\},'
    
    def replace_install(match):
        indent = match.group(1)
        description = match.group(2)
        config_args = match.group(3)
        
        return f'''{indent}type: StepType.INSTALL,
{indent}content: [
{indent}  {{
{indent}    type: 'text',
{indent}    text: {description},
{indent}  }},
{indent}  ...getPythonInstallConfig({config_args}).filter(config => config.code).map(config => ({{
{indent}    type: 'code' as const,
{indent}    tabs: config.code!,
{indent}  }})),
{indent}],
{indent}}},'''
    
    return re.sub(pattern, replace_install, content, flags=re.DOTALL)

def refactor_configure_section(content):
    """Refactor configure sections to use content arrays"""
    # Simple pattern for configure with just description and configurations
    pattern = r'(\s+)type: StepType\.CONFIGURE,\n\s+description: ((?:t|tct)\([\s\S]*?\)),\n\s+configurations: \[([\s\S]*?)\n\s+\],(?:\n\s+additionalInfo: ([\s\S]*?),)?'
    
    def replace_configure(match):
        indent = match.group(1)
        description = match.group(2)
        configs = match.group(3)
        additional_info = match.group(4) if len(match.groups()) > 3 else None
        
        result = f'''{indent}type: StepType.CONFIGURE,
{indent}content: [
{indent}  {{
{indent}    type: 'text',
{indent}    text: {description},
{indent}  }},'''
        
        # Extract code configuration
        code_match = re.search(r'language:\s*[\'"](\w+)[\'"],\s*code:\s*([\s\S]+?)(?=\n\s*\})', configs)
        if code_match:
            language = code_match.group(1)
            code = code_match.group(2)
            result += f'''
{indent}  {{
{indent}    type: 'code',
{indent}    language: '{language}',
{indent}    code: {code},
{indent}  }},'''
        
        if additional_info:
            result += f'''
{indent}  {{
{indent}    type: 'custom',
{indent}    content: {additional_info},
{indent}  }},'''
        
        result += f'''
{indent}],
{indent}}},'''
        
        return result
    
    return re.sub(pattern, replace_configure, content, flags=re.DOTALL)

def refactor_verify_section(content):
    """Refactor verify sections to use content arrays"""
    pattern = r'(\s+)type: StepType\.VERIFY,\n\s+description: (.*?),\n\s+configurations: \[([\s\S]*?)\n\s+\],'
    
    def replace_verify(match):
        indent = match.group(1)
        description = match.group(2)
        configs = match.group(3)
        
        result = f'''{indent}type: StepType.VERIFY,
{indent}content: [
{indent}  {{
{indent}    type: 'text',
{indent}    text: {description},
{indent}  }},'''
        
        # Extract code configurations
        code_matches = re.findall(r'language:\s*[\'"](\w+)[\'"],\s*code:\s*([\s\S]+?)(?=\n\s*\})', configs)
        for language, code in code_matches:
            result += f'''
{indent}  {{
{indent}    type: 'code',
{indent}    language: '{language}',
{indent}    code: {code},
{indent}  }},'''
        
        result += f'''
{indent}],
{indent}}},'''
        
        return result
    
    return re.sub(pattern, replace_verify, content, flags=re.DOTALL)

def process_file(filepath):
    """Process a single file"""
    print(f"Processing {filepath}...")
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Skip if already refactored
    if 'content: [' in content and 'configurations:' not in content:
        print(f"  Skipping {filepath} - already refactored")
        return
    
    # Apply refactoring
    original = content
    content = refactor_install_section(content)
    content = refactor_configure_section(content) 
    content = refactor_verify_section(content)
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"  Refactored {filepath}")
    else:
        print(f"  No changes needed for {filepath}")

def main():
    python_dir = Path('/workspace/static/app/gettingStartedDocs/python')
    
    # Files to process
    files_to_process = [
        'aiohttp.tsx',
        'tornado.tsx',
        'bottle.tsx',
        'falcon.tsx',
        'pyramid.tsx',
        'sanic.tsx',
        'starlette.tsx',
        'quart.tsx',
        'asgi.tsx',
        'wsgi.tsx',
        'rq.tsx',
        'awslambda.tsx',
        'serverless.tsx',
        'gcpfunctions.tsx',
        'chalice.tsx',
        'tryton.tsx',
        'mongo.tsx'
    ]
    
    for filename in files_to_process:
        filepath = python_dir / filename
        if filepath.exists():
            try:
                process_file(filepath)
            except Exception as e:
                print(f"  Error processing {filepath}: {e}")
        else:
            print(f"  File not found: {filepath}")

if __name__ == '__main__':
    main()