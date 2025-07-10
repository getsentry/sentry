# Sentry AI Settings Redesign - Technical Implementation & PR Description

## 📋 Pull Request Summary

This PR implements a comprehensive redesign of Sentry's AI settings interface, providing a unified experience for configuring Seer AI capabilities across organizations and projects. The new design eliminates confusion around "automation" terminology, consolidates scattered settings into a logical hierarchy, and enables efficient management of AI features at scale.

**Feature:** Sentry AI Settings Redesign
**Type:** Enhancement
**Scope:** Organization & Project Settings
**Release:** Q1 2024

## 🚀 What's New

### For Engineering Managers

- **Unified Organization Settings:** Single interface to configure AI defaults for all projects
- **Clear Terminology:** Replaced confusing "automation" language with explicit "scan" and "fix" terminology
- **Organization-Level Stopping Point:** Configure PR creation behavior at the organization level
- **Project Override Visibility:** Clear indicators showing which projects have custom settings

### For DevOps Engineers

- **Inline Repository Configuration:** Add and configure repositories directly from settings page
- **Expandable Project Controls:** Manage multiple projects without page navigation
- **Bulk Operations:** Apply settings changes to multiple projects efficiently
- **Advanced Settings Toggle:** Hide complex configurations by default

### For Technical Leads

- **Project Override Interface:** Easily customize AI behavior for specific projects
- **Repository Branch Management:** Configure branch patterns for AI processing
- **Inheritance Indicators:** Clear view of which settings come from organization defaults
- **Simplified Project Settings:** Streamlined project-specific configuration page

## 🔧 Technical Implementation

### Django Backend Architecture

#### Database Models (Django ORM)

```python
# src/sentry/models/ai_settings.py
from django.db import models
from sentry.db.models import (
    Model,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    JSONField,
    sane_repr,
)
from sentry.db.models.fields import EncryptedPickledObjectField

class OrganizationAISettings(Model):
    """Organization-level AI settings that serve as defaults for all projects"""
    __include_in_export__ = False

    organization = FlexibleForeignKey('sentry.Organization', unique=True)
    scan_enabled = models.BooleanField(default=True)
    fix_enabled = models.BooleanField(default=False)
    stopping_point = models.CharField(
        max_length=50,
        choices=[
            ('suggestion', 'Suggestion'),
            ('pull_request', 'Pull Request'),
            ('merge', 'Merge'),
        ],
        default='pull_request'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_organization_ai_settings'

    __repr__ = sane_repr('organization_id', 'scan_enabled', 'fix_enabled')

class ProjectAISettings(Model):
    """Project-level AI settings that override organization defaults"""
    __include_in_export__ = False

    project = FlexibleForeignKey('sentry.Project', unique=True)
    scan_enabled_override = models.BooleanField(null=True, blank=True)
    fix_enabled_override = models.BooleanField(null=True, blank=True)
    stopping_point_override = models.CharField(
        max_length=50,
        choices=[
            ('suggestion', 'Suggestion'),
            ('pull_request', 'Pull Request'),
            ('merge', 'Merge'),
        ],
        null=True, blank=True
    )
    repository_config = JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_project_ai_settings'

    __repr__ = sane_repr('project_id', 'scan_enabled_override', 'fix_enabled_override')
```

#### Django REST Framework API Endpoints

```python
# src/sentry/api/endpoints/organization_ai_settings.py
from rest_framework.response import Response
from rest_framework import serializers, status

from sentry.api.base import OrganizationEndpoint
from sentry.api.permissions import OrganizationPermission
from sentry.models.ai_settings import OrganizationAISettings
from sentry.utils.audit import create_audit_entry
from sentry.audit_log.events import AuditLogEvent

class OrganizationAISettingsSerializer(serializers.Serializer):
    scan_enabled = serializers.BooleanField(default=True)
    fix_enabled = serializers.BooleanField(default=False)
    stopping_point = serializers.ChoiceField(
        choices=['suggestion', 'pull_request', 'merge'],
        default='pull_request'
    )

class OrganizationAISettingsEndpoint(OrganizationEndpoint):
    permission_classes = [OrganizationPermission]

    def get(self, request, organization):
        """Get organization AI settings"""
        try:
            settings = OrganizationAISettings.objects.get(organization=organization)
        except OrganizationAISettings.DoesNotExist:
            # Return defaults if no settings exist
            settings = OrganizationAISettings(
                organization=organization,
                scan_enabled=True,
                fix_enabled=False,
                stopping_point='pull_request'
            )

        serializer = OrganizationAISettingsSerializer(settings)
        return Response(serializer.data)

    def put(self, request, organization):
        """Update organization AI settings"""
        serializer = OrganizationAISettingsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        settings, created = OrganizationAISettings.objects.get_or_create(
            organization=organization,
            defaults=serializer.validated_data
        )

        if not created:
            for key, value in serializer.validated_data.items():
                setattr(settings, key, value)
            settings.save()

        # Create audit log entry
        create_audit_entry(
            request=request,
            organization=organization,
            target_object=settings,
            event=AuditLogEvent.ORG_AI_SETTINGS_EDIT,
            data=settings.get_audit_log_data(),
        )

        return Response(OrganizationAISettingsSerializer(settings).data)
```

#### Django URL Configuration

```python
# src/sentry/api/urls.py (additions)
from sentry.api.endpoints.organization_ai_settings import OrganizationAISettingsEndpoint
from sentry.api.endpoints.project_ai_settings import ProjectAISettingsEndpoint

urlpatterns = [
    # Organization AI Settings
    url(
        r'^organizations/(?P<organization_slug>[^/]+)/ai-settings/$',
        OrganizationAISettingsEndpoint.as_view(),
        name='sentry-api-0-organization-ai-settings'
    ),

    # Project AI Settings
    url(
        r'^projects/(?P<organization_slug>[^/]+)/(?P<project_slug>[^/]+)/ai-settings/$',
        ProjectAISettingsEndpoint.as_view(),
        name='sentry-api-0-project-ai-settings'
    ),
]
```

### React Frontend Architecture

#### Component Structure

```typescript
// static/app/views/settings/organizationAISettings/index.tsx
import React, {useState, useEffect} from 'react';
import {RouteComponentProps} from 'react-router';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {Form, FormField} from 'app/components/forms';
import SwitchField from 'app/components/forms/switchField';
import SelectField from 'app/components/forms/selectField';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import {useApiQuery, useApiMutation} from 'app/utils/queryClient';

interface OrganizationAISettingsProps extends RouteComponentProps<{}, {}> {
  organization: Organization;
}

interface AISettings {
  scan_enabled: boolean;
  fix_enabled: boolean;
  stopping_point: 'suggestion' | 'pull_request' | 'merge';
}

const STOPPING_POINT_OPTIONS = [
  {value: 'suggestion', label: t('Suggestion Only')},
  {value: 'pull_request', label: t('Create Pull Request')},
  {value: 'merge', label: t('Merge Automatically')},
];

export default function OrganizationAISettings({organization}: OrganizationAISettingsProps) {
  const [settings, setSettings] = useState<AISettings>({
    scan_enabled: true,
    fix_enabled: false,
    stopping_point: 'pull_request',
  });

  const {
    data: settingsData,
    isLoading,
    error,
  } = useApiQuery<AISettings>([`/organizations/${organization.slug}/ai-settings/`], {
    staleTime: 0,
  });

  const updateSettingsMutation = useApiMutation({
    mutationFn: (data: AISettings) =>
      api.requestPromise(`/organizations/${organization.slug}/ai-settings/`, {
        method: 'PUT',
        data,
      }),
  });

  useEffect(() => {
    if (settingsData) {
      setSettings(settingsData);
    }
  }, [settingsData]);

  const handleSubmit = (data: AISettings) => {
    updateSettingsMutation.mutate(data, {
      onSuccess: () => {
        addSuccessMessage(t('AI settings updated successfully'));
      },
      onError: () => {
        addErrorMessage(t('Failed to update AI settings'));
      },
    });
  };

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (error) {
    return <LoadingError />;
  }

  return (
    <Panel>
      <PanelHeader>{t('AI Settings')}</PanelHeader>
      <PanelBody>
        <Form
          initialData={settings}
          onSubmit={handleSubmit}
          submitLabel={t('Save Changes')}
        >
          <FormField
            name="scan_enabled"
            label={t('Issue Scanning')}
            help={t('Automatically scan issues for potential problems')}
          >
            {({value, onChange}) => (
              <SwitchField
                isActive={value}
                toggle={() => onChange(!value)}
                size="lg"
              />
            )}
          </FormField>

          <FormField
            name="fix_enabled"
            label={t('Automatic Fixes')}
            help={t('Generate and apply fixes for detected issues')}
          >
            {({value, onChange}) => (
              <SwitchField
                isActive={value}
                toggle={() => onChange(!value)}
                size="lg"
              />
            )}
          </FormField>

          <FormField
            name="stopping_point"
            label={t('Stopping Point')}
            help={t('How far should AI processing go before requiring manual approval')}
          >
            {({value, onChange}) => (
              <SelectField
                options={STOPPING_POINT_OPTIONS}
                value={value}
                onChange={onChange}
                clearable={false}
              />
            )}
          </FormField>
        </Form>
      </PanelBody>
    </Panel>
  );
}
```

### File Structure (Updated for Django/React)

```
sentry/
├── src/sentry/
│   ├── api/
│   │   ├── endpoints/
│   │   │   ├── organization_ai_settings.py     # Organization AI settings API
│   │   │   ├── project_ai_settings.py          # Project AI settings API
│   │   │   └── organization_ai_projects.py     # Projects with overrides API
│   │   ├── serializers/
│   │   │   ├── ai_settings.py                  # AI settings serialization
│   │   │   └── project_ai_settings.py          # Project AI settings serialization
│   │   └── urls.py                             # API URL configuration
│   ├── models/
│   │   ├── ai_settings.py                      # AI settings models
│   │   └── project_ai_settings.py              # Project AI settings models
│   └── migrations/
│       └── XXXX_add_ai_settings.py             # Database migrations
└── static/app/
    ├── views/
    │   ├── settings/
    │   │   ├── organizationAISettings/
    │   │   │   ├── index.tsx                   # Main organization settings page
    │   │   │   ├── organizationDefaults.tsx    # Organization defaults component
    │   │   │   ├── projectOverrides.tsx        # Project overrides list
    │   │   │   └── projectSettingsRow.tsx      # Individual project settings
    │   │   └── projectAISettings/
    │   │       ├── index.tsx                   # Project AI settings page
    │   │       └── overrides.tsx               # Project override controls
    │   └── components/
    │       ├── aiSettings/
    │       │   ├── aiToggle.tsx                # Reusable AI toggle component
    │       │   ├── stoppingPointSelect.tsx     # Stopping point selector
    │       │   └── overrideIndicator.tsx       # Override indicator badge
    │       └── forms/
    │           └── aiSettingsForm.tsx          # Common AI settings form
    └── types/
        └── aiSettings.ts                       # TypeScript type definitions
```

## 🎯 Development Workflow

### Local Development Setup

```bash
# Start Sentry development services
sentry devservices up

# Run database migrations
sentry upgrade

# Frontend development (fastest for UI changes)
pnpm dev-ui
# Access at: https://dev.getsentry.net:7999

# Backend development (for API changes)
sentry run web
# Access at: http://localhost:9001

# Full stack development (when needed)
sentry devserver
# Access at: http://localhost:8000
```

### Testing Strategy

#### Backend Tests (Django)

```python
# tests/sentry/api/endpoints/test_organization_ai_settings.py
import pytest
from sentry.models.ai_settings import OrganizationAISettings
from sentry.testutils import APITestCase

class OrganizationAISettingsTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.url = f'/api/0/organizations/{self.organization.slug}/ai-settings/'

    def test_get_default_settings(self):
        response = self.client.get(self.url)
        assert response.status_code == 200
        assert response.data['scan_enabled'] is True
        assert response.data['fix_enabled'] is False
        assert response.data['stopping_point'] == 'pull_request'

    def test_update_settings(self):
        data = {
            'scan_enabled': False,
            'fix_enabled': True,
            'stopping_point': 'merge'
        }
        response = self.client.put(self.url, data)
        assert response.status_code == 200
        assert response.data['scan_enabled'] is False
        assert response.data['fix_enabled'] is True
        assert response.data['stopping_point'] == 'merge'

    def test_invalid_stopping_point(self):
        data = {
            'scan_enabled': True,
            'fix_enabled': False,
            'stopping_point': 'invalid'
        }
        response = self.client.put(self.url, data)
        assert response.status_code == 400
```

#### Frontend Tests (React)

```typescript
// static/app/views/settings/organizationAISettings/index.spec.tsx
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {Organization} from 'app/types';
import OrganizationAISettings from './index';

const mockOrganization: Organization = {
  slug: 'test-org',
  name: 'Test Organization',
  // ... other org properties
};

describe('OrganizationAISettings', () => {
  it('renders AI settings form', () => {
    render(<OrganizationAISettings organization={mockOrganization} />);

    expect(screen.getByText('Issue Scanning')).toBeInTheDocument();
    expect(screen.getByText('Automatic Fixes')).toBeInTheDocument();
    expect(screen.getByText('Stopping Point')).toBeInTheDocument();
  });

  it('updates settings when form is submitted', async () => {
    const mockPut = jest.fn();
    MockApiClient.addMockResponse({
      url: `/organizations/${mockOrganization.slug}/ai-settings/`,
      method: 'PUT',
      body: mockPut,
    });

    render(<OrganizationAISettings organization={mockOrganization} />);

    // Toggle fix enabled
    const fixToggle = screen.getByLabelText('Automatic Fixes');
    fireEvent.click(fixToggle);

    // Submit form
    const submitButton = screen.getByText('Save Changes');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith(
        expect.objectContaining({
          fix_enabled: true,
        })
      );
    });
  });
});
```

## 🎨 UI/UX Implementation

### Design System Integration

- **React Components:** TypeScript with functional components and hooks
- **Tailwind CSS:** Utility-first styling with custom design tokens
- **Sentry UI Library:** Consistent with existing Sentry design patterns
- **Responsive Design:** Mobile-first approach with progressive enhancement

### Key User Flows

#### Organization Settings Configuration

1. **Navigate to Organization AI Settings:** Single entry point for all AI configuration
2. **Configure Organization Defaults:** Set scanning, fixing, and stopping point defaults
3. **View Project Overrides:** See which projects have custom settings with visual indicators
4. **Expand Project Settings:** Click to expand inline project configuration
5. **Save Changes:** Immediate feedback with validation and success states

#### Project Override Management

1. **Enable Project Override:** Toggle to enable project-specific settings
2. **Configure Project Settings:** Override specific settings while maintaining inheritance
3. **Repository Configuration:** Add/remove repositories and configure branch patterns
4. **Reset to Defaults:** Option to revert to organization defaults
5. **View Inheritance:** Clear indication of which settings come from organization

#### Repository Management

1. **Add Repository:** Connect GitHub/GitLab/Bitbucket repositories
2. **Configure Branch Patterns:** Set branch patterns for AI processing
3. **Enable/Disable AI:** Toggle AI features per repository
4. **Monitor Repository Health:** View repository status and last configuration
5. **Bulk Operations:** Apply settings to multiple repositories

## 📊 Analytics & Monitoring Implementation

### Event Tracking

```typescript
// Settings interaction tracking
import {trackEvent} from 'sentry/utils/analytics';

// Organization settings changes
trackEvent('ai_settings_org_changed', {
  setting_type: 'scan_enabled|fix_enabled|stopping_point',
  new_value: value,
  project_count: organization.projects.length,
  user_role: userRole,
});

// Project override actions
trackEvent('ai_settings_project_override', {
  action: 'enabled|disabled|modified',
  project_id: projectId,
  settings_changed: changedSettings,
  inheritance_broken: hasOverrides,
});

// Repository configuration
trackEvent('ai_settings_repository_config', {
  action: 'added|removed|modified',
  repository_provider: 'github|gitlab|bitbucket',
  ai_enabled: isAIEnabled,
  branch_pattern: branchPattern,
});
```

### Error Monitoring

```typescript
// Settings save error tracking
import * as Sentry from '@sentry/react';

try {
  await updateOrganizationAISettings(orgId, settings);
  trackEvent('ai_settings_save_success', {
    settings_type: 'organization',
    time_to_complete: Date.now() - startTime,
  });
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      component: 'OrganizationAISettings',
      action: 'save_settings',
      organization_id: orgId,
    },
    extra: {
      settings_payload: settings,
      user_role: userRole,
    },
  });
}
```

## 🔐 Security & Permissions Implementation

### Access Control

```python
# Organization AI settings permission
class OrganizationAISettingsPermission(OrganizationPermission):
    scope_map = {
        'GET': ['org:read'],
        'PUT': ['org:admin'],
    }

# Project AI settings permission
class ProjectAISettingsPermission(ProjectPermission):
    scope_map = {
        'GET': ['project:read'],
        'PUT': ['project:admin'],
    }

# Repository management permission
class ProjectRepositoryPermission(ProjectPermission):
    scope_map = {
        'GET': ['project:read'],
        'POST': ['project:admin'],
        'PUT': ['project:admin'],
        'DELETE': ['project:admin'],
    }
```

### Input Validation

```python
# AI settings validation
from rest_framework import serializers

class OrganizationAISettingsSerializer(serializers.Serializer):
    scan_enabled = serializers.BooleanField(default=True)
    fix_enabled = serializers.BooleanField(default=False)
    stopping_point = serializers.ChoiceField(
        choices=['suggestion', 'pull_request', 'merge'],
        default='pull_request'
    )

    def validate_stopping_point(self, value):
        if value not in ['suggestion', 'pull_request', 'merge']:
            raise serializers.ValidationError("Invalid stopping point value")
        return value

class ProjectAISettingsSerializer(serializers.Serializer):
    scan_enabled_override = serializers.BooleanField(allow_null=True)
    fix_enabled_override = serializers.BooleanField(allow_null=True)
    stopping_point_override = serializers.ChoiceField(
        choices=['suggestion', 'pull_request', 'merge'],
        allow_null=True
    )
```

## 🧪 Testing Implementation

### Unit Tests

```typescript
// Organization AI settings tests
describe('OrganizationAISettings', () => {
  test('renders organization defaults correctly', () => {
    render(<OrganizationAISettings organization={mockOrg} />);
    expect(screen.getByText('Issue Scanning')).toBeInTheDocument();
    expect(screen.getByText('Automatic Fixes')).toBeInTheDocument();
  });

  test('shows project override indicators', () => {
    const orgWithOverrides = {...mockOrg, projects: [mockProjectWithOverrides]};
    render(<OrganizationAISettings organization={orgWithOverrides} />);
    expect(screen.getByText('Custom Settings')).toBeInTheDocument();
  });

  test('saves organization settings successfully', async () => {
    const mockSave = jest.fn();
    render(<OrganizationAISettings organization={mockOrg} onSave={mockSave} />);

    fireEvent.click(screen.getByLabelText('Enable Issue Scanning'));
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith({
        scan_enabled: true,
        fix_enabled: false,
        stopping_point: 'pull_request'
      });
    });
  });
});
```

### Integration Tests

```python
# API endpoint tests
class OrganizationAISettingsAPITest(APITestCase):
    def setUp(self):
        self.organization = self.create_organization()
        self.user = self.create_user()
        self.create_member(organization=self.organization, user=self.user, role='admin')

    def test_get_organization_ai_settings(self):
        url = f'/api/0/organizations/{self.organization.slug}/ai-settings/'
        response = self.client.get(url)

        assert response.status_code == 200
        assert 'scan_enabled' in response.data
        assert 'fix_enabled' in response.data
        assert 'stopping_point' in response.data

    def test_update_organization_ai_settings(self):
        url = f'/api/0/organizations/{self.organization.slug}/ai-settings/'
        data = {
            'scan_enabled': True,
            'fix_enabled': True,
            'stopping_point': 'merge'
        }
        response = self.client.put(url, data)

        assert response.status_code == 200
        assert response.data['fix_enabled'] is True
        assert response.data['stopping_point'] == 'merge'
```

### E2E Tests

```typescript
// End-to-end workflow tests
describe('AI Settings E2E', () => {
  test('complete organization settings configuration', async () => {
    // Navigate to organization settings
    await page.goto('/organizations/test-org/settings/ai/');

    // Configure organization defaults
    await page.click('[data-test-id="scan-enabled-toggle"]');
    await page.click('[data-test-id="fix-enabled-toggle"]');
    await page.selectOption('[data-test-id="stopping-point-select"]', 'pull_request');

    // Expand project settings
    await page.click('[data-test-id="expand-project-settings"]');

    // Configure project override
    await page.click('[data-test-id="enable-project-override"]');
    await page.click('[data-test-id="project-fix-enabled-toggle"]');

    // Save changes
    await page.click('[data-test-id="save-settings"]');

    // Verify success message
    await expect(page.locator('[data-test-id="success-message"]')).toBeVisible();
  });
});
```

## 📋 Deployment Checklist

### Pre-Deployment

- [ ] Database migrations tested in staging environment
- [ ] API endpoints tested with existing settings data
- [ ] Frontend components tested across browser compatibility matrix
- [ ] Performance testing completed with large project counts
- [ ] Security review completed for permission changes
- [ ] Documentation updated for new interface
- [ ] Support team trained on new settings interface

### Production Deployment

- [ ] Database migrations applied with zero downtime
- [ ] Feature flag enabled for gradual rollout
- [ ] API endpoints deployed with backward compatibility
- [ ] Frontend assets deployed to CDN
- [ ] Monitoring dashboards updated for new metrics
- [ ] Error tracking configured for new components
- [ ] A/B testing setup for interface comparison

### Post-Deployment

- [ ] Monitor error rates and performance metrics
- [ ] Collect user feedback through in-app surveys
- [ ] Track success metrics (configuration time, adoption rate)
- [ ] Monitor support ticket volume for AI-related issues
- [ ] Document lessons learned and iterate on interface
- [ ] Plan deprecation timeline for old interface elements

## 🔄 Migration Strategy

### Phase 1: Soft Launch (Week 1)

- Deploy new interface behind feature flag
- Enable for internal users and selected beta organizations
- Monitor performance and collect initial feedback
- Address critical bugs and UX issues
- Validate data migration and settings preservation

### Phase 2: Gradual Rollout (Weeks 2-3)

- Enable for 25% of organizations with <10 projects
- Monitor adoption rates and user behavior
- Collect feedback through in-app surveys
- Address usability issues and performance concerns
- Expand to 50% of organizations

### Phase 3: Full Deployment (Week 4)

- Enable for all organizations
- Monitor overall adoption and usage patterns
- Track success metrics against baseline
- Plan deprecation of old interface elements
- Prepare for follow-up iterations based on feedback

## 📈 Success Metrics Tracking

### Implementation Metrics

```typescript
// Success metrics dashboard
const successMetrics = {
  configurationTime: {
    baseline: 300, // 5 minutes average
    target: 120, // 2 minutes target
    current: trackingValue,
  },
  adoptionRate: {
    baseline: 0.45, // 45% adoption
    target: 0.56, // 56% target (+25%)
    current: trackingValue,
  },
  supportTickets: {
    baseline: 100, // per month
    target: 60, // 40% reduction
    current: trackingValue,
  },
  userSatisfaction: {
    baseline: 3.2, // out of 5
    target: 4.25, // 85% satisfaction
    current: trackingValue,
  },
};
```

### Post-Launch Monitoring

- Real-time dashboard for settings configuration success rate
- Weekly reports on AI feature adoption trends
- Monthly analysis of support ticket volume and categories
- Quarterly user satisfaction surveys with NPS scoring
- Continuous A/B testing for interface improvements

---

**Document History:**

- 2024-01-15: v1.0 - Initial implementation plan - [Author] - Detailed technical specifications
- 2024-01-15: v1.1 - Added testing and deployment details - [Author] - Enhanced with security and monitoring
