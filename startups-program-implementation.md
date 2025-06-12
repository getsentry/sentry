# Startups Program Implementation

## Overview
This document outlines the implementation of the configurable startups program feature that allows admins to grant customers access to startups programs. The system includes:
- Configurable program definitions stored in Sentry's configuration system
- Program-based credit allocation determined by configuration
- Program-type-specific welcome emails based on email template type
- Audit logging of all actions taken

## Configuration System

### Program Configuration Structure
Programs are defined in Sentry's configuration with the following structure:

```python
# In sentry/conf/server.py or via options
SENTRY_OPTIONS['startups_programs'] = {
    'ycombinator_current': {
        'name': 'YCombinator (Current)',
        'type': 'ycombinator',
        'creditAmount': 50001,  # $50,001
    },
    'general_startups': {
        'name': 'General Startups Program',
        'type': 'default',
        'creditAmount': 5000,   # $5,000
    },
}
```

### Program Configuration Fields
- **name**: Display name shown in the admin interface
- **type**: Determines which email template to use (`ycombinator` or `default`)
- **creditAmount**: Amount of credit in USD to grant to the customer

## Frontend Implementation (Completed)

### 1. StartupsAction Component (`static/gsAdmin/components/startupsAction.tsx`)
- Modal component that dynamically loads available programs from configuration
- Displays program choices with formatted credit amounts
- Real-time display of selected program benefits
- Uses `ConfigStore.get('startupsPrograms')` to fetch program configurations
- Sends `programId` to backend instead of hardcoded program type

### 2. Customer Details Page Integration (`static/gsAdmin/views/customerDetails.tsx`)
- Added "Grant Startups Program Access" action to the customer actions menu
- Located next to "Convert to Sponsored" action for logical grouping
- Requires billing admin permissions
- Disabled for partner accounts

## Backend Implementation (To Be Implemented)

### 1. Configuration Setup
Add startups programs configuration to Sentry's options system:

```python
# In sentry/conf/server.py or deployment configuration
SENTRY_OPTIONS['startups_programs'] = {
    'ycombinator_current': {
        'name': 'YCombinator (Current)',
        'type': 'ycombinator',
        'creditAmount': 50001,
    },
    'general_startups': {
        'name': 'General Startups Program',
        'type': 'default',
        'creditAmount': 5000,
    },
}
```

### 2. Customer API Endpoint
The customer API endpoint that handles `PUT /customers/{orgId}/` needs to be updated:

```python
from sentry import options

def put(self, request, organization):
    # ... existing code ...

    # Handle startups program enrollment
    if request.data.get('startupsProgram'):
        self.handle_startups_program_enrollment(
            organization=organization,
            program_id=request.data.get('programId'),
            notes=request.data.get('notes', ''),
            request=request
        )

    # ... existing code ...

def handle_startups_program_enrollment(self, organization, program_id, notes, request):
    """
    Handle startups program enrollment for a customer
    """
    # 1. Get program configuration
    program_config = self.get_program_config(program_id)
    if not program_config:
        raise ValidationError(f"Invalid program ID: {program_id}")

    # 2. Grant credit based on program configuration
    credit_amount_cents = program_config['creditAmount'] * 100  # Convert to cents
    self.grant_startups_credit(organization, credit_amount_cents)

    # 3. Send email based on program type
    self.send_startups_welcome_email(organization, program_config['type'])

    # 4. Log audit entry
    self.log_startups_program_audit(organization, program_config, notes, request)

def get_program_config(self, program_id):
    """
    Get program configuration by ID
    """
    programs = options.get('startups_programs', {})
    return programs.get(program_id)
```

### 3. Email System
Program-type-based email template selection:

```python
def send_startups_welcome_email(self, organization, program_type):
    """
    Send email based on program type (not specific program)
    """
    from sentry.utils.email import MessageBuilder

    # Get organization owners to send email to
    owners = organization.get_owners()
    if not owners:
        return

    # Determine email templates based on program type
    if program_type == 'ycombinator':
        text_template = 'sentry/emails/startups_ycombinator_welcome.txt'
        html_template = 'sentry/emails/startups_ycombinator_welcome.html'
        email_type = 'organization.startups_ycombinator_welcome'
        subject = f"{options.get('mail.subject-prefix')}Welcome to Sentry for YCombinator!"
    else:  # default type
        text_template = 'sentry/emails/startups_welcome.txt'
        html_template = 'sentry/emails/startups_welcome.html'
        email_type = 'organization.startups_welcome'
        subject = f"{options.get('mail.subject-prefix')}Welcome to the Sentry Startups Program!"

    context = {
        'organization': organization,
        'dashboard_url': organization.absolute_url('/'),
    }

    msg = MessageBuilder(
        subject=subject,
        template=text_template,
        html_template=html_template,
        type=email_type,
        context=context,
    )

    msg.send_async([owner.email for owner in owners])
```

### 4. Audit Logging
Enhanced audit logging with program configuration details:

```python
def log_startups_program_audit(self, organization, program_config, notes, request):
    """
    Log audit entry for startups program enrollment
    """
    from sentry.utils.audit import create_audit_entry
    from sentry import audit_log

    create_audit_entry(
        request=request,
        organization=organization,
        target_object=organization.id,
        event=audit_log.get_event_id('STARTUPS_PROGRAM_GRANTED'),
        data={
            'program_name': program_config['name'],
            'program_type': program_config['type'],
            'credit_amount_usd': program_config['creditAmount'],
            'credit_amount_cents': program_config['creditAmount'] * 100,
            'notes': notes,
        },
    )
```

### 5. Frontend Configuration Endpoint
Add endpoint to expose available programs to frontend:

```python
class StartupsConfigEndpoint(APIView):
    permission_classes = (SuperuserPermission,)

    def get(self, request):
        """
        Return available startups programs configuration
        """
        programs = options.get('startups_programs', {})
        return Response({'startupsPrograms': programs})
```

## Email Templates

### YCombinator Type (`type: "ycombinator"`)
- Text: `src/sentry/templates/sentry/emails/startups_ycombinator_welcome.txt`
- HTML: `src/sentry/templates/sentry/emails/startups_ycombinator_welcome.html`
- Features: YC branding (orange), YC-specific resources, YC support contacts

### Default Type (`type: "default"`)
- Text: `src/sentry/templates/sentry/emails/startups_welcome.txt`
- HTML: `src/sentry/templates/sentry/emails/startups_welcome.html`
- Features: Standard Sentry branding, general startup resources

**Note**: Email templates are selected by `type`, not by specific program. Multiple programs can share the same email template type.

## Configuration Management

### Adding New Programs
To add new programs, update the configuration:

```python
SENTRY_OPTIONS['startups_programs']['new_accelerator'] = {
    'name': 'New Accelerator Program',
    'type': 'default',  # or 'ycombinator' for YC-style emails
    'creditAmount': 7500,
}
```

### Updating Existing Programs
Programs can be updated without code changes:

```python
# Update credit amount
SENTRY_OPTIONS['startups_programs']['ycombinator_current']['creditAmount'] = 60000

# Update display name
SENTRY_OPTIONS['startups_programs']['ycombinator_current']['name'] = 'YCombinator (S25)'
```

## Testing

### Frontend Testing
1. Test with different program configurations
2. Verify dynamic program loading from configuration
3. Test credit amount formatting for various values
4. Test program selection and description updates

### Backend Testing
1. Test program configuration loading
2. Test invalid program ID handling
3. Test credit amount calculations from configuration
4. Test email type selection based on program type
5. Test audit logging with program details

### Configuration Testing
1. Test with empty program configuration
2. Test with malformed program configuration
3. Test program addition/removal
4. Test credit amount updates

## Security Considerations

1. **Authorization**: Feature requires billing admin permissions
2. **Input Validation**: Validate program ID against configured programs
3. **Configuration Validation**: Validate program configuration structure
4. **Rate Limiting**: Consider rate limiting for this admin action

## Benefits of Configurable Approach

1. **Flexibility**: Add/remove programs without code changes
2. **Credit Management**: Adjust credit amounts without deployment
3. **Program Names**: Update display names for seasons/cohorts
4. **Email Reuse**: Multiple programs can share email templates via type
5. **Easy Testing**: Different configurations for different environments

## Example Configurations

### Production Configuration
```python
SENTRY_OPTIONS['startups_programs'] = {
    'ycombinator_w25': {
        'name': 'YCombinator (Winter 2025)',
        'type': 'ycombinator',
        'creditAmount': 50001,
    },
    'ycombinator_s25': {
        'name': 'YCombinator (Summer 2025)',
        'type': 'ycombinator',
        'creditAmount': 50001,
    },
    'general_startups': {
        'name': 'General Startups Program',
        'type': 'default',
        'creditAmount': 5000,
    },
    'techstars': {
        'name': 'Techstars Program',
        'type': 'default',
        'creditAmount': 10000,
    },
}
```

### Development Configuration
```python
SENTRY_OPTIONS['startups_programs'] = {
    'test_program': {
        'name': 'Test Startups Program',
        'type': 'default',
        'creditAmount': 100,  # Small amount for testing
    },
}
```

## Files Modified/Created

### Frontend Files
- ✅ `static/gsAdmin/components/startupsAction.tsx` - Updated for configurable programs
- ✅ `static/gsAdmin/views/customerDetails.tsx` - Added action

### Email Templates (Existing)
- ✅ `src/sentry/templates/sentry/emails/startups_ycombinator_welcome.txt` - YC type emails
- ✅ `src/sentry/templates/sentry/emails/startups_ycombinator_welcome.html` - YC type emails
- ✅ `src/sentry/templates/sentry/emails/startups_welcome.txt` - Default type emails
- ✅ `src/sentry/templates/sentry/emails/startups_welcome.html` - Default type emails

### Backend Files (To Be Implemented)
- Configuration setup in deployment/server configuration
- Customer API endpoint updates for program handling
- Frontend configuration endpoint (optional)
- `src/sentry/audit_log/register.py` - Add audit log event
- Tests for configurable program functionality

### Documentation
- ✅ This implementation document (updated for configurable approach)
