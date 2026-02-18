'use strict';

/**
 * Static analysis script to extract form field definitions from useScrapsForm usage
 * Parses TypeScript/TSX files to find <form.AppField> components and extract metadata
 */
import {execSync} from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {fileURLToPath} from 'node:url';

import * as ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ExtractedField {
  formId: string;
  name: string;
  hintText?: string;
  label?: string;
  /** Route pattern for SettingsSearch (extracted from form.FormWrapper) */
  route?: string;
}

class FormFieldExtractor {
  private program: ts.Program;

  constructor(configPath: string) {
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsedConfig = ts.parseJsonConfigFileContent(
      config.config,
      ts.sys,
      path.dirname(configPath)
    );

    this.program = ts.createProgram({
      rootNames: parsedConfig.fileNames,
      options: parsedConfig.options,
    });
  }

  extractAllFields(): ExtractedField[] {
    const fields: ExtractedField[] = [];

    for (const sourceFile of this.program.getSourceFiles()) {
      // Skip node_modules
      if (sourceFile.fileName.includes('node_modules')) continue;

      // Only process app files
      if (!sourceFile.fileName.includes('static/app/')) continue;

      // Skip test and story files
      if (sourceFile.fileName.includes('.spec.')) continue;
      if (sourceFile.fileName.includes('.stories.')) continue;

      const fileFields = this.extractFromFile(sourceFile);
      fields.push(...fileFields);
    }

    return fields;
  }

  private extractFromFile(sourceFile: ts.SourceFile): ExtractedField[] {
    const fields: ExtractedField[] = [];
    const formId = this.getFormId(sourceFile);

    const visit = (node: ts.Node, parent?: ts.Node) => {
      // Set parent reference for ancestor traversal
      if (parent) {
        (node as any).parent = parent;
      }

      // Look for: <form.AppField name="...">
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
        const field = this.extractFieldFromJsx(node, formId, sourceFile);
        if (field) {
          fields.push(field);
        }
      }

      ts.forEachChild(node, child => visit(child, node));
    };

    visit(sourceFile);
    return fields;
  }

  private getFormId(sourceFile: ts.SourceFile): string {
    // Look for: const FORM_ID = 'user-profile'
    let formId: string | null = null;

    const visit = (node: ts.Node) => {
      if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name) && decl.name.text === 'FORM_ID') {
            if (decl.initializer && ts.isStringLiteral(decl.initializer)) {
              formId = decl.initializer.text;
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    // Fallback: use filename
    if (!formId) {
      const basename = path.basename(sourceFile.fileName, '.tsx');
      formId = basename.replace(/([A-Z])/g, '-$1').toLowerCase();
      // Remove leading dash if present (e.g., "FormStories" -> "-form-stories" -> "form-stories")
      if (formId.startsWith('-')) {
        formId = formId.slice(1);
      }
    }

    return formId;
  }

  private extractFieldFromJsx(
    node: ts.JsxElement | ts.JsxSelfClosingElement,
    formId: string,
    sourceFile: ts.SourceFile
  ): ExtractedField | null {
    // Check if this is <form.AppField> or <AutoSaveField>
    const tagName = this.getJsxTagName(node, sourceFile);
    const isAppField = tagName?.includes('AppField');
    const isAutoSaveField = tagName === 'AutoSaveField';
    if (!isAppField && !isAutoSaveField) {
      return null;
    }

    // Extract 'name' attribute
    const nameAttr = this.getJsxAttribute(node, 'name');
    if (!nameAttr) return null;

    // Extract metadata from render prop children
    const fieldMetadata = this.extractFieldMetadata(node, sourceFile);

    // Extract route from ancestor form.FormWrapper
    const route = this.extractRouteFromAncestors(node, sourceFile);

    return {
      name: nameAttr,
      formId,
      ...fieldMetadata,
      ...(route && {route}),
    };
  }

  /**
   * Walk up the AST to find a FormSearch ancestor and extract its route prop
   */
  private extractRouteFromAncestors(
    node: ts.Node,
    sourceFile: ts.SourceFile
  ): string | null {
    let current: ts.Node | undefined = node.parent;

    while (current) {
      if (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current)) {
        const tagName = this.getJsxTagName(current, sourceFile);
        // Match "FormSearch"
        if (tagName === 'FormSearch') {
          const route = this.getJsxAttribute(current, 'route');
          if (route) {
            return route;
          }
        }
      }
      current = current.parent;
    }

    return null;
  }

  private extractFieldMetadata(
    node: ts.JsxElement | ts.JsxSelfClosingElement,
    sourceFile: ts.SourceFile
  ): Partial<ExtractedField> {
    // For JsxElement, traverse children to find render prop
    if (ts.isJsxElement(node)) {
      for (const child of node.children) {
        if (ts.isJsxExpression(child) && child.expression) {
          // Look for arrow function: {field => <field.Input ... />}
          if (ts.isArrowFunction(child.expression)) {
            return this.extractFromRenderProp(child.expression, sourceFile);
          }
        }
      }
    }

    return {};
  }

  private extractFromRenderProp(
    arrowFn: ts.ArrowFunction,
    sourceFile: ts.SourceFile
  ): Partial<ExtractedField> {
    const metadata: Partial<ExtractedField> = {};

    // Traverse arrow function body to find label and hintText
    const visit = (node: ts.Node) => {
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tagName = this.getJsxTagName(node, sourceFile);

        // Extract label from Layout.Row, Layout.Stack, or field.Layout.Row/Stack
        if (
          tagName?.includes('Layout.Row') ||
          tagName?.includes('Layout.Stack') ||
          tagName === 'Layout.Row' ||
          tagName === 'Layout.Stack'
        ) {
          const label = this.getJsxAttribute(node, 'label');
          if (label && !metadata.label) metadata.label = label;

          const hintText = this.getJsxAttribute(node, 'hintText');
          if (hintText && !metadata.hintText) metadata.hintText = hintText;
        }

        // Extract label from field.Meta.Label (text is in children)
        if (tagName?.endsWith('.Label') || tagName === 'Meta.Label') {
          const text = this.getJsxTextContent(node);
          if (text && !metadata.label) metadata.label = text;
        }

        // Extract hintText from field.Meta.HintText (text is in children)
        if (tagName?.endsWith('.HintText') || tagName === 'Meta.HintText') {
          const text = this.getJsxTextContent(node);
          if (text && !metadata.hintText) metadata.hintText = text;
        }
      }

      ts.forEachChild(node, visit);
    };

    if (arrowFn.body) {
      visit(arrowFn.body);
    }

    return metadata;
  }

  /**
   * Extract text content from JSX element children (for Meta.Label, Meta.HintText)
   */
  private getJsxTextContent(
    node: ts.JsxElement | ts.JsxSelfClosingElement
  ): string | null {
    if (ts.isJsxSelfClosingElement(node)) {
      return null;
    }

    for (const child of node.children) {
      // Direct text: <Meta.Label>Name</Meta.Label>
      if (ts.isJsxText(child)) {
        const text = child.text.trim();
        if (text) return text;
      }
      // Expression: <Meta.Label>{t('Name')}</Meta.Label>
      if (ts.isJsxExpression(child) && child.expression) {
        if (ts.isStringLiteral(child.expression)) {
          return child.expression.text;
        }
        // t() call
        if (
          ts.isCallExpression(child.expression) &&
          ts.isIdentifier(child.expression.expression)
        ) {
          if (
            child.expression.expression.text === 't' &&
            child.expression.arguments.length > 0
          ) {
            const firstArg = child.expression.arguments[0];
            if (firstArg && ts.isStringLiteral(firstArg)) {
              return firstArg.text;
            }
          }
        }
      }
    }

    return null;
  }

  private getJsxTagName(
    node: ts.JsxElement | ts.JsxSelfClosingElement,
    sourceFile: ts.SourceFile
  ): string | null {
    const tagName = ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName;

    if (ts.isIdentifier(tagName)) {
      return tagName.text;
    }

    if (ts.isPropertyAccessExpression(tagName)) {
      // e.g., form.AppField or field.Input
      return tagName.getText(sourceFile);
    }

    return null;
  }

  private getJsxAttribute(
    node: ts.JsxElement | ts.JsxSelfClosingElement,
    attributeName: string
  ): string | null {
    const attributes = ts.isJsxElement(node)
      ? node.openingElement.attributes
      : node.attributes;

    for (const attr of attributes.properties) {
      if (
        ts.isJsxAttribute(attr) &&
        ts.isIdentifier(attr.name) &&
        attr.name.text === attributeName
      ) {
        if (attr.initializer) {
          // String literal: name="firstName"
          if (ts.isStringLiteral(attr.initializer)) {
            return attr.initializer.text;
          }
          // JSX expression: name={someName} or name={t('Label')}
          if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression) {
            const expr = attr.initializer.expression;
            // String literal: name={'firstName'}
            if (ts.isStringLiteral(expr)) {
              return expr.text;
            }
            // t() call: label={t('Name')}
            if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) {
              if (expr.expression.text === 't' && expr.arguments.length > 0) {
                const firstArg = expr.arguments[0];
                if (firstArg && ts.isStringLiteral(firstArg)) {
                  return firstArg.text;
                }
              }
            }
          }
        } else {
          // Boolean shorthand: required (no value)
          return '';
        }
      }
    }

    return null;
  }
}

function generateRegistryFile(fields: ExtractedField[], outputPath: string): void {
  // Dedupe fields by formId.name (last one wins for same key)
  const fieldMap = new Map<string, ExtractedField>();
  for (const field of fields) {
    const key = `${field.formId}.${field.name}`;
    fieldMap.set(key, field);
  }
  // Only include fields that are within a FormSearch component (have a route)
  const dedupedFields = Array.from(fieldMap.values()).filter(
    (f): f is ExtractedField & {route: string} => Boolean(f.route)
  );

  const formatField = (field: ExtractedField & {route: string}): string => {
    const lines = [
      `    name: '${field.name}',`,
      `    formId: '${field.formId}',`,
      `    route: '${field.route}',`,
    ];
    if (field.label) {
      lines.push(`    label: t('${field.label.replace(/'/g, "\\'")}'),`);
    }
    if (field.hintText) {
      lines.push(`    hintText: t('${field.hintText.replace(/'/g, "\\'")}'),`);
    }
    return lines.join('\n');
  };

  const registryEntries = dedupedFields
    .map(field => `  '${field.formId}.${field.name}': {\n${formatField(field)}\n  },`)
    .join('\n');

  const registryContent = `// Auto-generated by scripts/extractFormFields.ts
// DO NOT EDIT MANUALLY

import {t} from 'sentry/locale';

interface FormFieldDefinition {
  formId: string;
  name: string;
  /** Route pattern for SettingsSearch navigation */
  route: string;
  hintText?: string;
  label?: string;
}

export const FORM_FIELD_REGISTRY: Record<string, FormFieldDefinition> = {
${registryEntries}
};
`;

  fs.writeFileSync(outputPath, registryContent, 'utf-8');
  execSync(`pnpm prettier --write ${outputPath}`, {stdio: 'ignore'});
  console.log(`✅ Generated ${dedupedFields.length} field definitions in ${outputPath}`);
}

// Main execution
try {
  const configPath = path.join(__dirname, '../tsconfig.json');
  const extractor = new FormFieldExtractor(configPath);

  console.log('🔍 Extracting form fields from TypeScript files...');
  const fields = extractor.extractAllFields();

  const outputPath = path.join(
    __dirname,
    '../static/app/components/core/form/generatedFieldRegistry.ts'
  );

  generateRegistryFile(fields, outputPath);

  if (fields.length === 0) {
    console.warn(
      '⚠️  No form fields found. Make sure you have forms using useScrapsForm.'
    );
  }
} catch (error) {
  console.error('❌ Failed to extract form fields:', error);
  process.exit(1);
}
