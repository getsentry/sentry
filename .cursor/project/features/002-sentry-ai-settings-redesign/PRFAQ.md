# Sentry AI Settings Redesign - PRFAQ

## 📰 Press Release / Elevator Pitch

**Streamlined AI Settings Experience Now Available in Sentry**

Sentry has redesigned its AI settings interface to provide a unified, intuitive experience for configuring Seer AI capabilities across organizations and projects. The new design eliminates confusion around automation terminology, consolidates scattered settings into a logical hierarchy, and provides clear controls for issue scanning, auto-fixes, and repository management.

**What it does:** Simplifies AI configuration with organization-level defaults and project-level overrides in a single, intuitive interface
**Who it's for:** Engineering teams, DevOps administrators, and project managers using Sentry's AI features
**Why it matters:** Reduces configuration complexity and increases AI feature adoption through better user experience

## 🗣️ Customer Reaction

> "Finally! I can set up our AI preferences once at the org level and not worry about configuring each project individually. The new interface makes it crystal clear what's happening with our code fixes." - Senior DevOps Engineer

> "The old 'automation' terminology was so confusing. Now it's obvious what Seer will scan versus what it will actually fix automatically. Much better!" - Engineering Manager

> "I love how I can expand project settings right from the org page. No more jumping between different settings pages to configure our repos." - Technical Lead

## 🎯 Goals

### Qualitative Goals
- Eliminate user confusion around "automation" terminology
- Streamline the settings configuration workflow
- Provide clear hierarchy: organization defaults with project overrides
- Reduce cognitive load when managing multiple projects
- Improve AI feature discoverability and adoption

### Quantitative Goals
- Reduce settings configuration time by 60%
- Increase AI feature adoption by 25% within 90 days
- Decrease support tickets related to AI configuration by 40%
- Achieve 85% user satisfaction score for AI settings experience

## ❓ Frequently Asked Questions

### Customer FAQs
**Q: How do organization-level settings work with project overrides?**
A: Organization settings provide smart defaults for all projects. Individual projects can override these defaults as needed, with clear indicators showing what's been customized.

**Q: What happened to the separate project settings page?**
A: We've consolidated the most common settings into the organization view with expandable project controls. A simplified project settings page remains for advanced configurations.

**Q: Can I still configure different repos and branches per project?**
A: Yes! Repository configuration is now available directly from the organization settings page with an expandable interface, or through the dedicated project settings page.

**Q: What's the difference between "scan" and "fix" in the new interface?**
A: "Scan" means Seer will analyze issues and suggest fixes. "Fix" means Seer will automatically create pull requests with proposed solutions. The new interface makes this distinction clear.

### Internal FAQs
**Q: How does this impact existing user configurations?**
A: All existing settings are preserved and automatically migrated to the new structure. Users will see their current configurations reflected in the new interface.

**Q: What data do we need about project distribution?**
A: We need analytics on how many projects organizations typically have to validate our assumption that most management can happen at the org level.

**Q: How will this affect our support load?**
A: We expect reduced support tickets related to AI configuration, especially around terminology confusion and settings discovery.

## 🛠️ Product Requirements

### Core Features
- [ ] Unified organization-level AI settings dashboard
- [ ] Clear terminology replacing "automation" language
- [ ] Expandable project configuration from org view
- [ ] Visual indicators for project-level overrides
- [ ] Repository and branch configuration inline
- [ ] "Stopping Point for Fixes" at organization level
- [ ] Simplified project settings page for advanced configurations

### Nice-to-Have Features
- [ ] Advanced configuration toggle (hidden by default)
- [ ] Bulk project settings updates
- [ ] Settings export/import functionality
- [ ] Configuration templates for common setups

## 🎨 Mocks / Design Exploration

### User Interface Mockups
- Organization settings page with tabbed interface
- Expandable project rows with inline controls
- Clear visual hierarchy for defaults vs overrides
- Simplified language and terminology
- Repository configuration modal/drawer

### User Journey Map
1. User navigates to organization AI settings
2. Sees clear organization-level defaults
3. Can expand individual projects to override settings
4. Configures repositories and branches inline
5. Saves configuration with immediate feedback

### Technical Architecture
- Maintain existing API structure with UI improvements
- Add organization-level "stopping point" setting
- Implement project override indicators
- Optimize for common use cases (few projects per org)

## 🚀 Implementation Milestones

### Milestone 1: Foundation & Research
**Timeline:** Week 1-2
**Deliverables:**
- [ ] Analyze project distribution data across organizations
- [ ] Audit current settings and terminology
- [ ] Create wireframes for new unified interface
- [ ] Design language improvements (eliminate "automation" overload)

### Milestone 2: Organization Settings Redesign
**Timeline:** Week 3-4
**Deliverables:**
- [ ] Implement unified organization settings page
- [ ] Add organization-level stopping point configuration
- [ ] Create expandable project configuration interface
- [ ] Update terminology throughout the interface

### Milestone 3: Project Integration & Polish
**Timeline:** Week 5-6
**Deliverables:**
- [ ] Implement inline repository configuration
- [ ] Add project override indicators
- [ ] Simplify project settings page
- [ ] Complete user testing and refinements

## ❓ Open Questions

- [ ] What's the actual distribution of projects per organization?
- [ ] Should we completely eliminate the separate project settings page?
- [ ] How do we handle organizations with 50+ projects?
- [ ] What's the best way to indicate project-level overrides?
- [ ] Should advanced settings be hidden by default?

## ✅ Todo

- [ ] Research project distribution data
- [ ] Conduct user interviews on current pain points
- [ ] Create detailed wireframes and prototypes
- [ ] Plan terminology improvements
- [ ] Design migration strategy for existing configurations

## 📚 Resources

### Research & References
- [Sentry AI Documentation](https://docs.sentry.io/product/ai-in-sentry/)
- [Seer Documentation](https://docs.sentry.io/product/ai-in-sentry/seer/)
- [Current settings screenshots](attached)
- [User feedback on automation terminology](internal)

### Design Assets
- Current org settings page screenshot
- Current project settings page screenshot
- User flow diagrams
- Terminology audit document

### Technical Resources
- [Sentry Settings API Documentation](internal)
- [Seer Configuration Schema](internal)
- [Project Management API](internal)

---

**Document History:**
- 2024-01-15: v1.0 - Initial PRFAQ creation - [Author] - Based on user feedback and current interface analysis
