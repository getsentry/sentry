'use strict';

/**
 * Static analysis script to extract form field definitions from useScrapsForm usage
 * Parses TypeScript/TSX files to find <form.AppField> components and extract metadata
 */
import {execFileSync} from 'node:child_process';
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

/**
 * Determines whether a TypeScript expression resolves to a plain string value.
 * Only string literals and t() calls with a string literal argument are considered
 * string-typed; anything else (variables, conditionals, JSX elements, other calls)
 * causes the caller to bail out.
 */
function isStringTypeExpression(expr: ts.Expression): boolean {
  // 'Name' or "Name"
  if (ts.isStringLiteral(expr)) {
    return true;
  }

  // t('Name') — the i18n translation helper
  if (
    ts.isCallExpression(expr) &&
    ts.isIdentifier(expr.expression) &&
    expr.expression.text === 't' &&
    expr.arguments.length > 0 &&
    ts.isStringLiteral(expr.arguments[0]!)
  ) {
    return true;
  }

  return false;
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

    // First, find all FormSearch components
    const findFormSearches = (node: ts.Node) => {
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tagName = this.getJsxTagName(node, sourceFile);
        if (tagName === 'FormSearch') {
          const route = this.getJsxAttribute(node, 'route');
          if (route) {
            // Extract all fields inside this FormSearch
            this.extractFieldsFromFormSearch(node, formId, route, sourceFile, fields);
          }
        }
      }
      ts.forEachChild(node, findFormSearches);
    };

    findFormSearches(sourceFile);
    return fields;
  }

  /**
   * Extract all fields inside a FormSearch component
   */
  private extractFieldsFromFormSearch(
    formSearchNode: ts.JsxElement | ts.JsxSelfClosingElement,
    formId: string,
    route: string,
    sourceFile: ts.SourceFile,
    fields: ExtractedField[]
  ): void {
    const visit = (node: ts.Node) => {
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
        const field = this.extractFieldFromJsx(node, formId, route, sourceFile);
        if (field) {
          fields.push(field);
        }
      }
      ts.forEachChild(node, visit);
    };

    // Visit children of FormSearch
    if (ts.isJsxElement(formSearchNode)) {
      formSearchNode.children.forEach(visit);
    }
  }

  private getFormId(sourceFile: ts.SourceFile): string {
    let formId: string | null;

    // use filename, but if it's index.tsx, use the parent directory name instead
    let basename = path.basename(sourceFile.fileName, '.tsx');
    if (basename === 'index') {
      basename = path.basename(path.dirname(sourceFile.fileName));
    }
    formId = basename.replace(/([A-Z])/g, '-$1').toLowerCase();
    // Remove leading dash if present (e.g., "FormStories" -> "-form-stories" -> "form-stories")
    if (formId.startsWith('-')) {
      formId = formId.slice(1);
    }

    return formId;
  }

  private extractFieldFromJsx(
    node: ts.JsxElement | ts.JsxSelfClosingElement,
    formId: string,
    route: string,
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

    // Omit the entire entry if we cannot extract a string label
    if (!fieldMetadata.label) {
      return null;
    }

    return {
      name: nameAttr,
      formId,
      route,
      ...fieldMetadata,
    };
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

        // Extract label/hintText props from any component
        const label = this.getJsxAttributeExpression(node, 'label', sourceFile);
        if (label && !metadata.label) metadata.label = label;

        if (this.hasJsxAttribute(node, 'hintText') && !metadata.hintText) {
          const hintText = this.getJsxAttributeExpression(node, 'hintText', sourceFile);
          // Attribute present but non-string → serialize as empty string
          metadata.hintText = hintText ?? "''";
        }

        // Extract label from Meta.Label (text is in children)
        if (tagName?.endsWith('.Label') || tagName === 'Meta.Label') {
          const text = this.getJsxTextContent(node, sourceFile);
          if (text && !metadata.label) metadata.label = text;
        }

        // Extract hintText from Meta.HintText (text is in children)
        if (tagName?.endsWith('.HintText') || tagName === 'Meta.HintText') {
          if (!metadata.hintText) {
            const text = this.getJsxTextContent(node, sourceFile);
            // Tag present but non-string content → serialize as empty string
            metadata.hintText = text ?? "''";
          }
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
   * Extract text content from JSX element children as expression (for Meta.Label, Meta.HintText)
   * Returns the expression text as-is, preserving t() calls
   */
  private getJsxTextContent(
    node: ts.JsxElement | ts.JsxSelfClosingElement,
    sourceFile: ts.SourceFile
  ): string | null {
    if (ts.isJsxSelfClosingElement(node)) {
      return null;
    }

    for (const child of node.children) {
      // Direct text: <Meta.Label>Name</Meta.Label>
      if (ts.isJsxText(child)) {
        const text = child.text.trim();
        if (text) return `"${text}"`;
      }
      // Expression: <Meta.Label>{t('Name')}</Meta.Label> -> t('Name')
      if (ts.isJsxExpression(child) && child.expression) {
        const expr = child.expression;
        if (!isStringTypeExpression(expr)) {
          return null;
        }
        return expr.getText(sourceFile);
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

  /** Returns true if the JSX element has an attribute with the given name, regardless of its value. */
  private hasJsxAttribute(
    node: ts.JsxElement | ts.JsxSelfClosingElement,
    attributeName: string
  ): boolean {
    const attributes = ts.isJsxElement(node)
      ? node.openingElement.attributes
      : node.attributes;

    return attributes.properties.some(
      attr =>
        ts.isJsxAttribute(attr) &&
        ts.isIdentifier(attr.name) &&
        attr.name.text === attributeName
    );
  }

  /**
   * Get the string value of a JSX attribute (extracts from t() calls)
   * Used for 'name' attribute where we want just the identifier
   */
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

  /**
   * Get the expression text of a JSX attribute as-is (preserves t() calls)
   * Used for 'label' and 'hintText' where we want the full expression
   */
  private getJsxAttributeExpression(
    node: ts.JsxElement | ts.JsxSelfClosingElement,
    attributeName: string,
    sourceFile: ts.SourceFile
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
          // String literal: label="Name"
          if (ts.isStringLiteral(attr.initializer)) {
            return `"${attr.initializer.text}"`;
          }
          // JSX expression: label={t('Name')} -> t('Name')
          if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression) {
            const expr = attr.initializer.expression;
            if (!isStringTypeExpression(expr)) {
              return null;
            }
            return expr.getText(sourceFile);
          }
        }
      }
    }

    return null;
  }
}

function generateRegistryFile(fields: ExtractedField[], outputPath: string): void {
  // Dedupe fields by formId.name (last one wins for same key)
  const fieldMap = new Map<string, ExtractedField & {route: string}>();
  for (const field of fields) {
    const key = `${field.formId}.${field.name}`;
    // All fields have a route since they're extracted from inside FormSearch
    fieldMap.set(key, field as ExtractedField & {route: string});
  }
  const dedupedFields = Array.from(fieldMap.values());

  const formatField = (field: ExtractedField & {route: string}): string => {
    const lines = [
      `    name: '${field.name}',`,
      `    formId: '${field.formId}',`,
      `    route: '${field.route}',`,
    ];
    if (field.label) {
      lines.push(`    label: ${field.label},`);
    }
    if (field.hintText) {
      lines.push(`    hintText: ${field.hintText},`);
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
  execFileSync('pnpm', ['prettier', '--write', outputPath], {stdio: 'ignore'});
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
