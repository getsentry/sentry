# Startups Program Implementation

## Overview
This document outlines the implementation of the startups program feature that allows admins to grant customers access to a startups program, which includes:
- Program-based credit allocation (YCombinator: $50,001, Other: $5,000)
- Program-specific welcome emails
- Audit logging of all actions taken

## Frontend Implementation (Completed)

### 1. StartupsAction Component (`static/gsAdmin/components/startupsAction.tsx`)
- Modal component for selecting startups program type
- Program options:
  - **YCombinator (Current)**: $50,001 in credits
  - **Other**: $5,000 in credits
- Optional notes field for admin documentation
- Real-time display of selected program benefits
- Follows the same pattern as `SponsorshipAction`

### 2. Customer Details Page Integration (`static/gsAdmin/views/customerDetails.tsx`)
- Added "Grant Startups Program Access" action to the customer actions menu
- Located next to "Convert to Sponsored" action for logical grouping
- Requires billing admin permissions
- Disabled for partner accounts

## Backend Implementation (To Be Implemented)

### 1. Customer API Endpoint
The customer API endpoint that handles `PUT /customers/{orgId}/` needs to be updated to handle the new `startupsProgram` parameter:

```python
# In the customer details API endpoint (likely in getsentry codebase)
def put(self, request, organization):
    # ... existing code ...

    # Handle startups program enrollment
    if request.data.get('startupsProgram'):
        self.handle_startups_program_enrollment(
            organization=organization,
            program_type=request.data.get('programType', 'other'),
            notes=request.data.get('notes', ''),
            request=request
        )

    # ... existing code ...

def handle_startups_program_enrollment(self, organization, program_type, notes, request):
    """
    Handle startups program enrollment for a customer
    """
    # 1. Determine credit amount based on program type
    credit_amount = self.get_program_credit_amount(program_type)

    # 2. Grant credit to the customer account
    self.grant_startups_credit(organization, credit_amount)

    # 3. Send program-specific welcome email
    self.send_startups_welcome_email(organization, program_type)

    # 4. Log audit entry
    self.log_startups_program_audit(organization, program_type, credit_amount, notes, request)

    # 5. Update customer record with startups program flag
    # (depending on your data model)

def get_program_credit_amount(self, program_type):
    """
    Map program type to credit amount
    """
    program_credits = {
        'ycombinator': 5000100,  # $50,001 in cents
        'other': 500000,         # $5,000 in cents
    }
    return program_credits.get(program_type, 500000)  # Default to $5,000
```

### 2. Credit Granting System
Based on the existing credit system patterns:

```python
def grant_startups_credit(self, organization, credit_amount):
    """
    Grant credit to customer account for startups program
    Similar to existing admin credit functionality
    """
    # This would use the existing credit/balance system
    # Pattern similar to changeBalanceAction functionality
    pass
```

### 3. Email System
Program-specific email templates and sending:

#### Email Templates Created

**YCombinator Program Templates:**
- Text: `sentry/emails/startups_ycombinator_welcome.txt`
- HTML: `sentry/emails/startups_ycombinator_welcome.html`
- Features: YC branding, $50,001 credits, YC-specific resources

**Other Startups Program Templates:**
- Text: `sentry/emails/startups_welcome.txt`
- HTML: `sentry/emails/startups_welcome.html`
- Features: Generic Sentry branding, $5,000 credits, general startup resources

#### Email Sending Code:
```python
def send_startups_welcome_email(self, organization, program_type):
    """
    Send program-specific welcome email for startups program enrollment
    """
    from sentry.utils.email import MessageBuilder

    # Get organization owners to send email to
    owners = organization.get_owners()
    if not owners:
        return

    # Determine email templates and context based on program type
    if program_type == 'ycombinator':
        text_template = 'sentry/emails/startups_ycombinator_welcome.txt'
        html_template = 'sentry/emails/startups_ycombinator_welcome.html'
        email_type = 'organization.startups_ycombinator_welcome'
        subject = f"{options.get('mail.subject-prefix')}Welcome to Sentry for YCombinator!"
    else:
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
Add audit log entry for startups program enrollment:

```python
def log_startups_program_audit(self, organization, program_type, credit_amount, notes, request):
    """
    Log audit entry for startups program enrollment
    """
    from sentry.utils.audit import create_audit_entry
    from sentry import audit_log

    # Determine program display name
    program_names = {
        'ycombinator': 'YCombinator',
        'other': 'Other Startups'
    }
    program_display = program_names.get(program_type, program_type)

    create_audit_entry(
        request=request,
        organization=organization,
        target_object=organization.id,
        event=audit_log.get_event_id('STARTUPS_PROGRAM_GRANTED'),
        data={
            'program_type': program_type,
            'program_display': program_display,
            'credit_amount': credit_amount,
            'credit_amount_usd': credit_amount / 100,  # Convert cents to dollars for display
            'notes': notes,
        },
    )
```

#### Audit Log Event Registration
Add to `src/sentry/audit_log/register.py`:

```python
default_manager.add(
    AuditLogEvent(
        event_id=220,  # Use next available ID
        name="STARTUPS_PROGRAM_GRANTED",
        api_name="startups-program.granted",
        template="granted {program_display} startups program access with ${credit_amount_usd} credit: {notes}",
    )
)
```

## Testing

### Frontend Testing
Test the admin action:
1. Navigate to a customer details page in admin
2. Click the "Grant Startups Program Access" action
3. Verify the modal appears with program selection and notes fields
4. Test switching between YCombinator and Other programs
5. Verify credit amount display updates correctly
6. Test form validation and submission

### Backend Testing
Create tests for:
1. Program type to credit amount mapping
2. Program-specific email template selection
3. Credit granting functionality
4. Email sending (mock the email backend)
5. Audit logging with program information
6. Error handling for various edge cases

### Integration Testing
1. Full end-to-end test of both program types
2. Verify correct credits are applied (YC: $50,001, Other: $5k)
3. Verify correct email templates are sent
4. Verify audit log entries contain program information

## Security Considerations

1. **Authorization**: Feature requires billing admin permissions
2. **Input Validation**: Validate program type against allowed values
3. **Rate Limiting**: Consider rate limiting for this admin action
4. **Audit Trail**: Full audit logging implemented for compliance

## Program Specifications

### YCombinator Program
- **Credit Amount**: $50,001
- **Email Templates**: YC-branded with orange color scheme
- **Features**:
  - Priority YC support
  - YC-specific resources and documentation
  - YC founders community access
  - YC startup playbook

### Other Startups Program
- **Credit Amount**: $5,000
- **Email Templates**: Standard Sentry branding
- **Features**:
  - Standard startup resources
  - General documentation and guides
  - Standard support channels

## Future Enhancements

1. **Additional Programs**: Add more startup programs (e.g., Techstars, 500 Startups)
2. **Program Analytics**: Track program usage and effectiveness by type
3. **Automated Eligibility**: Criteria-based automatic program assignment
4. **Program Limits**: Add limits on enrollment frequency per program type

## Rollout Plan

1. **Phase 1**: Deploy frontend and backend changes to staging
2. **Phase 2**: Test with internal accounts for both program types
3. **Phase 3**: Deploy to production with feature flag
4. **Phase 4**: Enable for billing admins
5. **Phase 5**: Monitor usage and gather feedback by program type

## Files Modified/Created

### Frontend Files
- ✅ `static/gsAdmin/components/startupsAction.tsx` - Updated for program selection
- ✅ `static/gsAdmin/views/customerDetails.tsx` - Added action

### Email Templates
- ✅ `src/sentry/templates/sentry/emails/startups_ycombinator_welcome.txt` - YC text email
- ✅ `src/sentry/templates/sentry/emails/startups_ycombinator_welcome.html` - YC HTML email
- ✅ `src/sentry/templates/sentry/emails/startups_welcome.txt` - Generic text email (updated)
- ✅ `src/sentry/templates/sentry/emails/startups_welcome.html` - Generic HTML email (updated)

### Backend Files (To Be Implemented)
- Customer API endpoint (getsentry-specific) - Program type handling
- `src/sentry/audit_log/register.py` - Add audit log event
- Tests for all new functionality

### Documentation
- ✅ This implementation document (updated)
