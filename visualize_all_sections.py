#!/usr/bin/env python3
"""
Script to visualize all styled components data sections over time.
Creates separate charts for each data section.
"""

import os
import re
from datetime import datetime
from pathlib import Path
import matplotlib.pyplot as plt
import pandas as pd
from collections import defaultdict


def parse_date_from_filename(filename):
    """Extract date from filename in format YYYY-MM-DD-hash.txt"""
    match = re.match(r'(\d{4}-\d{2}-\d{2})', filename)
    if match:
        return datetime.strptime(match.group(1), '%Y-%m-%d')
    return None


def parse_file(filepath):
    """Parse a single data file and extract all sections"""
    sections = {}
    current_section = None
    section_data = {}

    with open(filepath, 'r') as f:
        lines = f.readlines()

    for line in lines:
        line = line.strip()

        # Check for section headers
        if line.startswith('=== ') and line.endswith(' ==='):
            # Save previous section if it has data
            if current_section and section_data:
                sections[current_section] = section_data.copy()
                section_data.clear()

            current_section = line[4:-4]  # Remove === markers
            continue

        # Skip empty lines and metadata
        if not line or current_section == 'METADATA':
            continue

        # Parse different section formats
        if current_section and ',' in line:
            parts = line.split(',')

            # Skip header rows
            if any(header in line for header in ['Component,Instances', 'CSSRule,Instances',
                                                'Type,Component,Instances', 'Key,Value',
                                                'Rank,Component,Location']):
                continue

            # Handle different section formats
            if current_section == 'TOP 10 MOST COMMONLY STYLED COMPONENTS':
                if len(parts) == 2:
                    component, instances = parts[0], int(parts[1])
                    section_data[component] = instances

            elif current_section == 'TOP 10 MOST COMMONLY USED CSS RULES':
                if len(parts) == 2:
                    rule, instances = parts[0], int(parts[1])
                    section_data[rule] = instances

            elif current_section == 'CORE COMPONENT USAGE (ALL COMPONENTS)':
                if len(parts) == 2 and parts[0] and parts[1].isdigit():
                    component, instances = parts[0], int(parts[1])
                    section_data[component] = instances

            elif current_section == 'CORE COMPONENT USAGE (SUMMARY)':
                if len(parts) == 2 and parts[1].isdigit():
                    key, value = parts[0], int(parts[1])
                    section_data[key] = value

            elif current_section == 'CORE COMPONENT USAGE (LAYOUT)':
                if len(parts) == 3 and parts[1] and parts[2].isdigit():
                    component, instances = parts[1], int(parts[2])
                    section_data[component] = instances

            elif current_section == 'CORE COMPONENT USAGE (TEXT)':
                if len(parts) == 3 and parts[1] and parts[2].isdigit():
                    component, instances = parts[1], int(parts[2])
                    section_data[component] = instances

    # Don't forget the last section
    if current_section and section_data:
        sections[current_section] = section_data.copy()

    return sections


def load_all_data(directory):
    """Load data from all files in the directory"""
    all_data = defaultdict(dict)
    all_dates = set()
    all_components_by_section = defaultdict(set)

    # First pass: collect all dates and components per section
    for filename in sorted(os.listdir(directory)):
        if filename.endswith('.txt'):
            date = parse_date_from_filename(filename)
            if date:
                all_dates.add(date)
                filepath = os.path.join(directory, filename)
                sections = parse_file(filepath)
                for section_name, section_data in sections.items():
                    if section_data:  # Only add if we found data
                        all_data[section_name][date] = section_data
                        all_components_by_section[section_name].update(section_data.keys())

    # Second pass: fill in missing data with 0 values
    for section_name in all_data:
        all_components = all_components_by_section[section_name]
        for date in all_dates:
            if date not in all_data[section_name]:
                all_data[section_name][date] = {}

            # Ensure all components have values for this date
            for component in all_components:
                if component not in all_data[section_name][date]:
                    all_data[section_name][date][component] = 0

    return dict(all_data)


def create_section_chart(section_name, data_dict, save_dir):
    """Create a line chart for a specific section"""
    if not data_dict:
        return None

    # Convert to DataFrame
    df = pd.DataFrame(data_dict).T  # Transpose so dates are rows
    df = df.fillna(0)  # Fill NaN with 0
    df = df.sort_index()  # Sort by date

    # Create the plot
    plt.figure(figsize=(7.5, 5))

    # Set Berkeley Mono font
    import matplotlib.font_manager
    matplotlib.font_manager.fontManager.addfont('/Users/jonasbadalic/Library/Fonts/BerkeleyMono-Regular.otf')
    plt.rcParams['font.family'] = ['Berkeley Mono', 'CommitMono', 'PT Mono', 'DejaVu Sans Mono', 'monospace']

    # Get top components (by latest values) to avoid cluttered charts
    if len(df.columns) > 10:
        latest_values = df.iloc[-1].sort_values(ascending=False)
        top_components = latest_values.head(10).index
        df = df[top_components]

    # Plot each component/metric as a line
    # Use Sentry's modern chart color palette
    sentry_colors = [
        '#7553FF',  # Primary purple
        '#F0369A',  # Pink
        '#FF9838',  # Orange
        '#67C800',  # Green
        '#5533B2',  # Dark purple
        '#3A1873',  # Darker purple
        '#7C2282',  # Purple-pink
        '#B82D90',  # Dark pink
        '#FA6769',  # Red-pink
        '#BACE05',  # Light green
    ]

    for i, component in enumerate(df.columns):
        color = sentry_colors[i % len(sentry_colors)]
        plt.plot(df.index, df[component], marker='o', markersize=3, linewidth=2,
                label=component, color=color)

    plt.title(f'{section_name} Over Time', fontsize=16, pad=20)
    plt.xlabel('Date', fontsize=12)
    plt.ylabel('Number of Instances', fontsize=12)
    plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
    plt.grid(True, alpha=0.3)

    # Rotate x-axis labels for better readability
    plt.xticks(rotation=45)

    # Adjust layout to prevent legend cutoff
    plt.tight_layout()

    # Save the plot
    safe_filename = re.sub(r'[^a-zA-Z0-9\s]', '_', section_name)
    safe_filename = re.sub(r'\s+', '_', safe_filename).lower()
    output_file = os.path.join(save_dir, f'{safe_filename}.png')
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    plt.close()  # Close to free memory

    return output_file, df


def print_section_summary(section_name, df):
    """Print summary statistics for a section"""
    if df.empty:
        return

    print(f"\n=== {section_name} ===")
    print(f"Date range: {df.index[0].strftime('%Y-%m-%d')} to {df.index[-1].strftime('%Y-%m-%d')}")
    print(f"Items tracked: {len(df.columns)}")

    # Show trends for top items
    print("Latest vs First Data Point (Top 5):")
    latest = df.iloc[-1]
    first = df.iloc[0]

    # Sort by latest values and show top 5
    top_items = latest.sort_values(ascending=False).head(5)

    for item in top_items.index:
        if item in first.index:
            change = latest[item] - first[item]
            change_pct = (change / first[item] * 100) if first[item] > 0 else float('inf')
            print(f"  {item}: {first[item]:.0f} → {latest[item]:.0f} ({change:+.0f}, {change_pct:+.1f}%)")
        else:
            print(f"  {item}: New entry → {latest[item]:.0f}")


def main():
    """Main function to run the visualization"""
    data_directory = 'analyze-styled-latest'
    output_directory = 'styled_components_charts'

    if not os.path.exists(data_directory):
        print(f"Directory {data_directory} not found!")
        return

    # Create output directory
    os.makedirs(output_directory, exist_ok=True)

    print("Loading data from files...")
    all_sections_data = load_all_data(data_directory)

    if not all_sections_data:
        print("No data found!")
        return

    print(f"Found {len(all_sections_data)} sections with data")

    # Create charts for each section
    print("Creating visualizations...")
    created_files = []

    for section_name, data_dict in all_sections_data.items():
        print(f"Processing: {section_name}")
        result = create_section_chart(section_name, data_dict, output_directory)
        if result:
            output_file, df = result
            created_files.append(output_file)
            print_section_summary(section_name, df)

    print(f"\n=== Summary ===")
    print(f"Created {len(created_files)} charts in '{output_directory}/' directory:")
    for file_path in created_files:
        print(f"  - {os.path.basename(file_path)}")

    # Create an overview chart showing total files analyzed over time
    metadata_files = []
    total_files_data = {}

    for filename in sorted(os.listdir(data_directory)):
        if filename.endswith('.txt'):
            date = parse_date_from_filename(filename)
            if date:
                filepath = os.path.join(data_directory, filename)
                with open(filepath, 'r') as f:
                    content = f.read()
                    # Extract total files from metadata
                    match = re.search(r'TotalFiles,(\d+)', content)
                    if match:
                        total_files_data[date] = int(match.group(1))

    if total_files_data:
        plt.figure(figsize=(6, 3))

        # Set Berkeley Mono font
        plt.rcParams['font.family'] = 'Berkeley Mono'
        dates = sorted(total_files_data.keys())
        values = [total_files_data[date] for date in dates]
        plt.plot(dates, values, marker='o', markersize=3, linewidth=2, color='#7553FF')
        plt.title('Total Files Analyzed Over Time', fontsize=16, pad=20)
        plt.xlabel('Date', fontsize=12)
        plt.ylabel('Number of Files', fontsize=12)
        plt.grid(True, alpha=0.3)
        plt.xticks(rotation=45)
        plt.tight_layout()

        overview_file = os.path.join(output_directory, 'total_files_analyzed.png')
        plt.savefig(overview_file, dpi=300, bbox_inches='tight')
        plt.close()
        print(f"  - {os.path.basename(overview_file)} (overview)")


if __name__ == "__main__":
    main()
