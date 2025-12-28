"""
Database Migration Script for UUID Fix

This script helps migrate existing data if you're changing from string UUIDs
to proper UUID column types.
"""

from uuid import UUID
from sqlalchemy import create_engine, Column, String, inspect, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import sessionmaker


def check_column_type(engine, table_name: str, column_name: str) -> str:
    """
    Check the current type of a column.
    
    Args:
        engine: SQLAlchemy engine
        table_name: Name of the table
        column_name: Name of the column
        
    Returns:
        str: Column type name
    """
    inspector = inspect(engine)
    columns = inspector.get_columns(table_name)
    
    for col in columns:
        if col['name'] == column_name:
            return str(col['type'])
    
    raise ValueError(f"Column {column_name} not found in table {table_name}")


def migrate_string_to_uuid_postgresql(
    engine,
    table_name: str,
    column_name: str,
    dry_run: bool = True
):
    """
    Migrate a string UUID column to native PostgreSQL UUID type.
    
    Args:
        engine: SQLAlchemy engine
        table_name: Name of the table
        column_name: Name of the column to migrate
        dry_run: If True, only print SQL without executing
    """
    print(f"\n{'='*70}")
    print(f"Migration: {table_name}.{column_name} (STRING → UUID)")
    print(f"{'='*70}\n")
    
    # Step 1: Check current type
    current_type = check_column_type(engine, table_name, column_name)
    print(f"Current column type: {current_type}")
    
    if "UUID" in str(current_type).upper():
        print("✅ Column is already UUID type, no migration needed!")
        return
    
    # Step 2: Create migration SQL
    sql_steps = [
        # Validate all existing values are valid UUIDs
        f"""
        -- Step 1: Validate all values are valid UUIDs
        DO $$
        DECLARE
            invalid_count INTEGER;
        BEGIN
            SELECT COUNT(*) INTO invalid_count
            FROM {table_name}
            WHERE {column_name}::text !~ '^[0-9a-f]{{8}}-[0-9a-f]{{4}}-[0-9a-f]{{4}}-[0-9a-f]{{4}}-[0-9a-f]{{12}}$';
            
            IF invalid_count > 0 THEN
                RAISE EXCEPTION 'Found % invalid UUID values in column {column_name}', invalid_count;
            END IF;
            
            RAISE NOTICE 'All values are valid UUIDs';
        END $$;
        """,
        
        # Alter column type
        f"""
        -- Step 2: Alter column type to UUID
        ALTER TABLE {table_name}
        ALTER COLUMN {column_name}
        TYPE UUID USING {column_name}::UUID;
        """,
        
        # Add comment
        f"""
        -- Step 3: Add comment documenting the migration
        COMMENT ON COLUMN {table_name}.{column_name} IS 
        'Migrated from VARCHAR to UUID for type safety';
        """
    ]
    
    if dry_run:
        print("\n📋 DRY RUN - SQL to be executed:\n")
        for i, sql in enumerate(sql_steps, 1):
            print(f"/* Step {i} */")
            print(sql.strip())
            print()
        print("\n⚠️  Run with dry_run=False to execute")
    else:
        print("\n🔄 Executing migration...\n")
        with engine.begin() as conn:
            for i, sql in enumerate(sql_steps, 1):
                print(f"Step {i}: ", end="")
                try:
                    conn.execute(text(sql))
                    print("✅ Success")
                except Exception as e:
                    print(f"❌ Failed: {e}")
                    raise
        
        print("\n✅ Migration completed successfully!")
    
    # Step 3: Verify
    new_type = check_column_type(engine, table_name, column_name)
    print(f"\nNew column type: {new_type}")


def validate_uuid_data(engine, table_name: str, column_name: str):
    """
    Validate that all values in a column are valid UUIDs.
    
    Args:
        engine: SQLAlchemy engine
        table_name: Name of the table
        column_name: Name of the column to validate
    """
    print(f"\n{'='*70}")
    print(f"Validating UUID data: {table_name}.{column_name}")
    print(f"{'='*70}\n")
    
    with engine.connect() as conn:
        # Get all values
        result = conn.execute(
            text(f"SELECT DISTINCT {column_name} FROM {table_name} LIMIT 1000")
        )
        
        valid_count = 0
        invalid_values = []
        
        for row in result:
            value = row[0]
            try:
                # Try to parse as UUID
                if isinstance(value, str):
                    UUID(value)
                elif isinstance(value, UUID):
                    pass  # Already a UUID
                else:
                    invalid_values.append((value, type(value).__name__))
                valid_count += 1
            except ValueError:
                invalid_values.append((value, "Invalid UUID format"))
        
        print(f"Valid UUIDs: {valid_count}")
        
        if invalid_values:
            print(f"\n❌ Found {len(invalid_values)} invalid values:")
            for value, error in invalid_values[:10]:  # Show first 10
                print(f"  - {value}: {error}")
            if len(invalid_values) > 10:
                print(f"  ... and {len(invalid_values) - 10} more")
            return False
        else:
            print("✅ All values are valid UUIDs!")
            return True


def create_migration_script(table_name: str, column_name: str) -> str:
    """
    Generate an Alembic migration script for the UUID fix.
    
    Args:
        table_name: Name of the table
        column_name: Name of the column to migrate
        
    Returns:
        str: Alembic migration script content
    """
    return f'''"""Convert {column_name} from VARCHAR to UUID

Revision ID: uuid_fix_001
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'uuid_fix_001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    """Upgrade to UUID type."""
    # Validate all values are valid UUIDs before migration
    connection = op.get_bind()
    result = connection.execute(
        sa.text("""
            SELECT COUNT(*) 
            FROM {table_name}
            WHERE {column_name}::text !~ '^[0-9a-f]{{8}}-[0-9a-f]{{4}}-[0-9a-f]{{4}}-[0-9a-f]{{4}}-[0-9a-f]{{12}}$'
        """)
    )
    invalid_count = result.scalar()
    
    if invalid_count > 0:
        raise ValueError(
            f"Cannot migrate: Found {{invalid_count}} invalid UUID values in {column_name}"
        )
    
    # Alter column type
    op.alter_column(
        '{table_name}',
        '{column_name}',
        type_=postgresql.UUID(as_uuid=True),
        postgresql_using='{column_name}::UUID'
    )


def downgrade():
    """Downgrade to VARCHAR type."""
    op.alter_column(
        '{table_name}',
        '{column_name}',
        type_=sa.String(36),
        postgresql_using='{column_name}::VARCHAR(36)'
    )
'''


# Example usage
if __name__ == "__main__":
    import sys
    
    print("\n" + "="*70)
    print("Database Migration Tool for UUID Fix")
    print("="*70)
    
    # Configuration
    DATABASE_URL = "postgresql://user:password@localhost/database"
    TABLE_NAME = "email_monitoring_configs"
    COLUMN_NAME = "user_id"
    
    print(f"""
Configuration:
  Database: {DATABASE_URL}
  Table: {TABLE_NAME}
  Column: {COLUMN_NAME}
    """)
    
    # Uncomment to run:
    # engine = create_engine(DATABASE_URL)
    
    # Step 1: Validate data
    # print("\nStep 1: Validating data...")
    # if not validate_uuid_data(engine, TABLE_NAME, COLUMN_NAME):
    #     print("\n❌ Fix invalid UUIDs before proceeding!")
    #     sys.exit(1)
    
    # Step 2: Run migration (dry run first)
    # print("\nStep 2: Running migration (DRY RUN)...")
    # migrate_string_to_uuid_postgresql(engine, TABLE_NAME, COLUMN_NAME, dry_run=True)
    
    # Step 3: Run actual migration
    # print("\nStep 3: Running actual migration...")
    # response = input("Proceed with migration? (yes/no): ")
    # if response.lower() == "yes":
    #     migrate_string_to_uuid_postgresql(engine, TABLE_NAME, COLUMN_NAME, dry_run=False)
    # else:
    #     print("Migration cancelled")
    
    # Step 4: Generate Alembic migration
    print("\nGenerating Alembic migration script...")
    migration_script = create_migration_script(TABLE_NAME, COLUMN_NAME)
    
    output_file = "alembic_uuid_migration.py"
    with open(output_file, "w") as f:
        f.write(migration_script)
    
    print(f"✅ Migration script saved to: {output_file}")
    print("""
Next steps:
1. Review the generated migration script
2. Place it in your alembic/versions/ directory
3. Run: alembic upgrade head
    """)
