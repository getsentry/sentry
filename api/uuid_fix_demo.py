"""
Demonstration of UUID Fix for SQLAlchemy AttributeError

This script demonstrates the problem and solution for the error:
AttributeError: 'str' object has no attribute 'hex'
"""

from uuid import UUID, uuid4
from sqlalchemy import create_engine, Column, String, Integer
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker


Base = declarative_base()


class User(Base):
    """Example user model with UUID primary key."""
    __tablename__ = "users"
    
    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(100), nullable=False)
    age = Column(Integer, nullable=True)


def demonstrate_problem():
    """Demonstrate the AttributeError that occurs with string UUIDs."""
    print("\n" + "="*70)
    print("DEMONSTRATING THE PROBLEM")
    print("="*70)
    
    # Create in-memory SQLite database
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    # Create a test user
    user = User(id=uuid4(), name="John Doe", age=30)
    session.add(user)
    session.commit()
    
    print(f"\nCreated user: {user.id} (type: {type(user.id).__name__})")
    
    # PROBLEM: Using string UUID in query
    user_id_string = str(user.id)
    print(f"\nAttempting query with STRING UUID: '{user_id_string}' (type: {type(user_id_string).__name__})")
    
    try:
        result = session.query(User).filter(User.id == user_id_string).first()
        print(f"❌ UNEXPECTED: Query succeeded with string UUID: {result}")
        print("   (This might work in SQLite but fails in PostgreSQL)")
    except AttributeError as e:
        print(f"❌ ERROR: {e}")
        print(f"   This is the bug we're fixing!")
    except Exception as e:
        print(f"❌ ERROR: {type(e).__name__}: {e}")
    
    session.close()


def demonstrate_solution():
    """Demonstrate the correct way using UUID objects."""
    print("\n" + "="*70)
    print("DEMONSTRATING THE SOLUTION")
    print("="*70)
    
    # Create in-memory SQLite database
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    # Create a test user
    user = User(id=uuid4(), name="Jane Doe", age=25)
    session.add(user)
    session.commit()
    
    print(f"\nCreated user: {user.id} (type: {type(user.id).__name__})")
    
    # SOLUTION: Using UUID object in query
    user_id_uuid = user.id  # Already a UUID object
    print(f"\nQuerying with UUID OBJECT: {user_id_uuid} (type: {type(user_id_uuid).__name__})")
    
    try:
        result = session.query(User).filter(User.id == user_id_uuid).first()
        print(f"✅ SUCCESS: Found user: {result.name} (age: {result.age})")
        print(f"   UUID object has .hex attribute: {user_id_uuid.hex}")
    except Exception as e:
        print(f"❌ ERROR: {type(e).__name__}: {e}")
    
    session.close()


def demonstrate_conversion():
    """Demonstrate how to convert string UUID to UUID object."""
    print("\n" + "="*70)
    print("DEMONSTRATING STRING TO UUID CONVERSION")
    print("="*70)
    
    # Example: You have a string UUID from a token
    user_id_string = "00000000-0000-0000-0000-000000000001"
    print(f"\nStarting with STRING: '{user_id_string}' (type: {type(user_id_string).__name__})")
    print(f"Has .hex attribute? {hasattr(user_id_string, 'hex')}")
    
    # Convert to UUID object
    user_id_uuid = UUID(user_id_string)
    print(f"\nConverted to UUID: {user_id_uuid} (type: {type(user_id_uuid).__name__})")
    print(f"Has .hex attribute? {hasattr(user_id_uuid, 'hex')}")
    print(f"UUID.hex value: '{user_id_uuid.hex}'")
    
    # Create in-memory database and test
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    # Create user with our UUID
    user = User(id=user_id_uuid, name="Alice", age=28)
    session.add(user)
    session.commit()
    
    print(f"\nCreated user with converted UUID")
    
    # Query using UUID object
    result = session.query(User).filter(User.id == user_id_uuid).first()
    print(f"✅ Query with UUID object: Found {result.name}")
    
    # Show that we can convert string -> UUID -> query in one flow
    another_string = str(user_id_uuid)
    converted_again = UUID(another_string)
    result2 = session.query(User).filter(User.id == converted_again).first()
    print(f"✅ Query with re-converted UUID: Found {result2.name}")
    
    session.close()


def show_fix_pattern():
    """Show the exact fix pattern for the email monitoring code."""
    print("\n" + "="*70)
    print("FIX PATTERN FOR EMAIL MONITORING CODE")
    print("="*70)
    
    print("""
BEFORE (BROKEN):
---------------
def get_user_id_from_token(db: Session) -> str:
    '''Returns string UUID'''
    # ... extract from token ...
    return "00000000-0000-0000-0000-000000000001"  # String!

def get_email_configs(db: Session):
    user_id = get_user_id_from_token(db)  # Gets string
    configs = db.query(EmailMonitoringConfig).filter(
        EmailMonitoringConfig.user_id == user_id  # String in UUID column -> ERROR
    ).all()


AFTER (FIXED):
-------------
from uuid import UUID

def get_user_id_from_token(db: Session) -> UUID:
    '''Returns UUID object'''
    # ... extract from token ...
    user_id_str = "00000000-0000-0000-0000-000000000001"
    return UUID(user_id_str)  # Convert to UUID object!

def get_email_configs(db: Session):
    user_id = get_user_id_from_token(db)  # Gets UUID object
    configs = db.query(EmailMonitoringConfig).filter(
        EmailMonitoringConfig.user_id == user_id  # UUID object -> SUCCESS
    ).all()
    """)


if __name__ == "__main__":
    print("\n" + "="*70)
    print("SQLAlchemy UUID AttributeError Fix Demonstration")
    print("="*70)
    
    # Run demonstrations
    demonstrate_problem()
    demonstrate_solution()
    demonstrate_conversion()
    show_fix_pattern()
    
    print("\n" + "="*70)
    print("KEY TAKEAWAY")
    print("="*70)
    print("""
When using SQLAlchemy UUID columns with as_uuid=True:
✅ ALWAYS use UUID objects in queries
❌ NEVER use string UUIDs in queries

Quick fix:
from uuid import UUID
user_id = UUID(user_id_string)  # Convert string to UUID before query
    """)
    print("="*70 + "\n")
