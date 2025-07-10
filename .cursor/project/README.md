# Project Documentation & Organization

## 🎯 Purpose

This directory serves as a flexible space for organizing project-specific documentation and monorepo structure information.

## 📂 Current Structure

```
.cursor/project/
├── README.md              # This file - main organization guide
├── dir-name/              # Flexible documentation collection space
│   └── README.md          # Instructions for organizing misc docs
└── features/              # Feature development templates
    └── 001-template/      # PRFAQ → PRD → GTM workflow templates
```

## 🗂️ Directory Purposes

### `/dir-name/` - Flexible Documentation Space

A versatile directory for organizing miscellaneous documentation. Can be used for:

- **Monorepo organization** - Document multiple apps/packages
- **Domain-specific docs** - Group by business area (auth, payments, etc.)
- **Operational guides** - Deployment, troubleshooting, runbooks
- **Research notes** - Technology evaluations and experiments

**Usage:** Rename to match your project needs (e.g., `apps/`, `domains/`, `operations/`)

### `/features/` - Feature Development Templates

Contains templates for structured feature development:

- **PRFAQ** - Problem definition and solution validation
- **PRD** - Technical requirements and specifications
- **GTM** - Go-to-market strategy and launch planning
- **Implementation** - Technical implementation guidance

**Usage:** Copy `001-template/` for each new feature (e.g., `002-auth-system/`)

## 📂 Recommended Structure Examples

### For Monorepo Projects

```
.cursor/project/
├── README.md
├── apps/                  # Rename dir-name to apps
│   ├── web-frontend/
│   ├── api-backend/
│   ├── mobile-app/
│   └── admin-dashboard/
└── features/
    ├── 001-template/
    ├── 002-user-auth/
    └── 003-payment-system/
```

### For Single Application Projects

```
.cursor/project/
├── README.md
├── documentation/         # Rename dir-name to documentation
│   ├── architecture/
│   ├── operations/
│   ├── research/
│   └── troubleshooting/
└── features/
    ├── 001-template/
    ├── 002-dashboard/
    └── 003-reporting/
```

### For Domain-Driven Projects

```
.cursor/project/
├── README.md
├── domains/              # Rename dir-name to domains
│   ├── user-management/
│   ├── billing/
│   ├── analytics/
│   └── notifications/
└── features/
    ├── 001-template/
    ├── 002-user-profiles/
    └── 003-subscription-billing/
```

## 📋 Documentation Types

### Essential Documents

- **README.md** - Overview and quick start for each component
- **Architecture docs** - High-level system design and decisions
- **Feature docs** - Detailed feature specifications and implementation notes
- **Operations docs** - Deployment, monitoring, and maintenance guides

### Optional Documents

- **Research notes** - Technology evaluations and experiments
- **Meeting notes** - Important architectural decisions and discussions
- **Troubleshooting guides** - Common issues and solutions
- **Performance analysis** - Benchmarks and optimization notes

## 🔧 Usage Guidelines

### Getting Started

1. **Rename `dir-name/`** to something meaningful for your project
2. **Review the structure examples** above for inspiration
3. **Create subdirectories** based on your organization needs
4. **Use the feature templates** for structured development

### Creating New Documentation

1. **Start with a README** - Always create a README.md in new subdirectories
2. **Use descriptive names** - Make directory and file names self-explanatory
3. **Follow markdown standards** - Use consistent formatting and structure
4. **Link between documents** - Create navigation between related docs

### Organizing Content

- **Group by domain** - Keep related documentation together
- **Use consistent naming** - Follow kebab-case for directories and files
- **Maintain hierarchy** - Don't go too deep (max 2-3 levels recommended)
- **Regular cleanup** - Archive or remove outdated documentation

## 📝 Markdown Best Practices

### File Naming Convention

```
feature-name.md           # Use kebab-case
api-documentation.md      # Descriptive names
troubleshooting-guide.md  # Clear purpose
```

### Document Structure

```markdown
# Document Title

## 🎯 Purpose

Brief overview of what this document covers

## 📋 Content

Main content sections with clear headings

## 🔗 Related Documents

Links to related documentation

## 📅 Last Updated

Date and reason for last update
```

### Internal Linking

```markdown
<!-- Link to other project docs -->

[Architecture Overview](./dir-name/architecture/README.md)

<!-- Link to features -->

[User Authentication Feature](./features/002-auth-system/README.md)

<!-- Link to main cursor rules -->

[Coding Guidelines](../rules/coding-guidelines.md)
```

## 🎯 Integration with Cursor Rules

This project documentation works alongside the main cursor rules:

- **Rules directory** (`../rules/`) - Contains AI assistant guidelines and coding standards
- **Project directory** (`./`) - Contains project-specific documentation and organization
- **Feature templates** - Use the feature development workflow from the rules

## 📋 Maintenance

### Regular Tasks

- [ ] Review and update documentation quarterly
- [ ] Remove outdated documents and links
- [ ] Ensure all directories have README files
- [ ] Check that links are working and up-to-date
- [ ] Archive completed features or deprecated components

### When Adding New Components

- [ ] Create a new subdirectory with descriptive name
- [ ] Add README.md explaining the component
- [ ] Link to/from other related documentation
- [ ] Update this main README if adding new patterns

---

> 💡 **Tip**: This structure is flexible - adapt it to your project's needs. The key is maintaining clear organization and keeping documentation close to the code it describes.
