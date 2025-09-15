import * as Sentry from '@sentry/react';

import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {useTraceItemAttributeKeys} from 'sentry/views/explore/hooks/useTraceItemAttributeKeys';

import {
  AllowedDataScrubbingDatasets,
  MethodType,
  RuleType,
  SourceSuggestionType,
  type Rule,
  type SourceSuggestion,
} from './types';

function getRuleLabel(type: RuleType) {
  switch (type) {
    case RuleType.ANYTHING:
      return t('Anything');
    case RuleType.IMEI:
      return t('IMEI numbers');
    case RuleType.MAC:
      return t('MAC addresses');
    case RuleType.EMAIL:
      return t('Email addresses');
    case RuleType.PEMKEY:
      return t('PEM keys');
    case RuleType.URLAUTH:
      return t('Auth in URLs');
    case RuleType.USSSN:
      return t('US social security numbers');
    case RuleType.USER_PATH:
      return t('Usernames in filepaths');
    case RuleType.UUID:
      return t('UUIDs');
    case RuleType.CREDITCARD:
      return t('Credit card numbers');
    case RuleType.PASSWORD:
      return t('Password fields');
    case RuleType.IP:
      return t('IP addresses');
    case RuleType.PATTERN:
      return t('Regex matches');
    default:
      return '';
  }
}

function getMethodLabel(type: MethodType) {
  switch (type) {
    case MethodType.MASK:
      return {
        label: t('Mask'),
        description: t('Replace with ****'),
      };
    case MethodType.HASH:
      return {
        label: t('Hash'),
        description: t('Replace with DEADBEEF'),
      };
    case MethodType.REMOVE:
      return {
        label: t('Remove'),
        description: t('Replace with null'),
      };
    case MethodType.REPLACE:
      return {
        label: t('Replace'),
        description: t('Replace with Placeholder'),
      };
    default:
      return {
        label: '',
      };
  }
}

/**
 * Short label for use in the rule descriptions
 */
function getDatasetLabel(dataset: AllowedDataScrubbingDatasets) {
  const labelMap: Record<AllowedDataScrubbingDatasets, string> = {
    [AllowedDataScrubbingDatasets.DEFAULT]: t('Events'),
    [AllowedDataScrubbingDatasets.LOGS]: t('Logs'),
  };
  return labelMap[dataset];
}

/**
 * For use in the datascrubbing modal's dataset selector
 */
export function getDatasetLabelLong(dataset: AllowedDataScrubbingDatasets) {
  const labelMap: Record<AllowedDataScrubbingDatasets, string> = {
    [AllowedDataScrubbingDatasets.DEFAULT]: t('Errors, Transactions, Attachments'),
    [AllowedDataScrubbingDatasets.LOGS]: t('Logs'),
  };
  return labelMap[dataset];
}

const binarySuggestions: SourceSuggestion[] = [
  {
    type: SourceSuggestionType.BINARY,
    value: '&&',
  },
  {
    type: SourceSuggestionType.BINARY,
    value: '||',
  },
];

const unarySuggestions: SourceSuggestion[] = [
  {
    type: SourceSuggestionType.UNARY,
    value: '!',
  },
];

const valueSuggestions: SourceSuggestion[] = [
  {
    type: SourceSuggestionType.VALUE,
    value: '**',
    description: t('all default PII fields'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: 'password',
    description: t('fields named "password"'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: '$error.value',
    description: t('the exception value'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: '$message',
    description: t('the message on logentry'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: 'extra.MyValue',
    description: t('the key "MyValue" in "Additional Data"'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: 'extra.**',
    description: t('everything in "Additional Data"'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: '$http.headers.x-custom-token',
    description: t('the X-Custom-Token HTTP header'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: '$user.ip_address',
    description: t('the user IP address'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: '$frame.vars.foo',
    description: t('the local variable "foo"'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: 'contexts.device.timezone',
    description: t('the timezone in the device context'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: 'tags.server_name',
    description: t('the tag "server_name"'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: '$attachments.**',
    description: t('all attachments'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: "$attachments.'logfile.txt'",
    description: t('all attachments named "logfile.txt"'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: '$minidump',
    description: t('the entire minidump of a native crash report'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: '$minidump.heap_memory',
    description: t('the heap memory region in a native crash report'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: 'code_file',
    description: t('the pathname of a code module in a native crash report'),
  },
  {
    type: SourceSuggestionType.VALUE,
    value: 'debug_file',
    description: t('the pathname of a debug module in a native crash report'),
  },
];

export {
  binarySuggestions,
  getMethodLabel,
  getRuleLabel,
  unarySuggestions,
  valueSuggestions,
};

export function getRuleDescription(rule: Rule) {
  const {method, type} = rule;
  const traceItemFieldSelector = TraceItemFieldSelector.fromRule(rule);
  const dataset =
    traceItemFieldSelector?.getDataset() ?? AllowedDataScrubbingDatasets.DEFAULT;
  const methodLabel = getMethodLabel(method);
  const typeLabel = getRuleLabel(type);
  const sourceLabel = getSourceLabel(rule);
  const datasetLabel = getDatasetLabel(dataset);

  const descriptionDetails: string[] = [];

  if (dataset !== AllowedDataScrubbingDatasets.DEFAULT) {
    descriptionDetails.push(`[${datasetLabel}]`);
  }

  descriptionDetails.push(`[${methodLabel.label}]`);

  descriptionDetails.push(
    rule.type === RuleType.PATTERN ? `[${rule.pattern}]` : `[${typeLabel}]`
  );

  if (rule.method === MethodType.REPLACE && rule.placeholder) {
    descriptionDetails.push(`with [${rule.placeholder}]`);
  }

  return `${descriptionDetails.join(' ')} ${t('from')} [${sourceLabel}]`;
}

/**
 * This indicates whether the data scrubbing modal shows "dataset" selector, which can be used to select new datasets that only allow for TraceItem attribute scrubbing.
 */
export function areScrubbingDatasetsEnabled(organization: Organization) {
  // Currently only logs supports scrubbing datasets.
  return organization.features.includes('ourlogs-enabled');
}

function getSourceLabel(rule: Rule) {
  const traceItemFieldSelector = TraceItemFieldSelector.fromRule(rule);
  if (traceItemFieldSelector) {
    const field = traceItemFieldSelector.toField();
    return field ?? rule.source;
  }
  return rule.source;
}

interface SelectorToFieldMapping {
  fieldName: string;
  regex: RegExp;
}

interface SelectorToAttributeMapping {
  regex: RegExp;
}

export class TraceItemFieldSelector {
  private selector: string;
  private dataset: AllowedDataScrubbingDatasets;

  private static readonly selectorToFieldMap: Record<
    AllowedDataScrubbingDatasets,
    Array<SelectorToFieldMapping | SelectorToAttributeMapping>
  > = {
    [AllowedDataScrubbingDatasets.LOGS]: [
      {
        regex: /^\$log\.attributes\.'([^']+)'\.value$/,
      },
      {
        regex: /^\$log\.body$/,
        fieldName: 'message',
      },
    ],
    [AllowedDataScrubbingDatasets.DEFAULT]: [],
  };

  private static readonly datasetSelectorMap: Record<
    AllowedDataScrubbingDatasets,
    string | null
  > = {
    [AllowedDataScrubbingDatasets.LOGS]: '$log',
    [AllowedDataScrubbingDatasets.DEFAULT]: null,
  };

  private static readonly fieldToSelectorMap: Record<
    AllowedDataScrubbingDatasets,
    (alias: string) => string | null
  > = {
    [AllowedDataScrubbingDatasets.LOGS]: (alias: string) => {
      if (alias === 'message') {
        return '$log.body';
      }
      return `$log.attributes.'${alias}'.value`;
    },
    [AllowedDataScrubbingDatasets.DEFAULT]: () => null,
  };

  constructor(selector: string, dataset: AllowedDataScrubbingDatasets) {
    this.selector = selector;
    this.dataset = dataset;
  }

  static isTraceItemField(
    dataset: AllowedDataScrubbingDatasets,
    selector: string
  ): boolean {
    const prefix = TraceItemFieldSelector.datasetSelectorMap[dataset];
    return prefix ? selector.startsWith(prefix) : false;
  }

  static fromRule(rule: Rule): TraceItemFieldSelector | null {
    const dataset = TraceItemFieldSelector.determineDataset(rule.source);
    if (dataset === AllowedDataScrubbingDatasets.DEFAULT) {
      return null;
    }
    return TraceItemFieldSelector.fromSourceString(rule.source);
  }

  static fromSourceString(source: string): TraceItemFieldSelector | null {
    // TODO: This is a hack to get the attribute selector from the rule source, which aren't strictly 1:1.
    // Rule source may actually contain negation, disjunction or conjunctions (! && || etc.), but aside from
    // AllowedDataScrubbingDatasets.DEFAULT all rules are currently one rule per dataset.
    const dataset = TraceItemFieldSelector.determineDataset(source);
    if (dataset === AllowedDataScrubbingDatasets.DEFAULT) {
      return null;
    }
    return new TraceItemFieldSelector(source, dataset);
  }

  private static determineDataset(selector: string): AllowedDataScrubbingDatasets {
    const dataset = Object.entries(TraceItemFieldSelector.datasetSelectorMap).find(
      ([_, includes]) => selector.startsWith(includes ?? '')
    );
    if (dataset) {
      return dataset[0] as AllowedDataScrubbingDatasets;
    }
    return AllowedDataScrubbingDatasets.DEFAULT;
  }

  static getAllStaticFields(
    dataset: AllowedDataScrubbingDatasets
  ): SelectorToFieldMapping[] {
    const mappings = TraceItemFieldSelector.selectorToFieldMap[dataset];
    return mappings.filter(mapping => 'fieldName' in mapping);
  }

  private static getAttributeMapping(
    dataset: AllowedDataScrubbingDatasets
  ): SelectorToAttributeMapping | null {
    const mappings = TraceItemFieldSelector.selectorToFieldMap[dataset];
    const attributeMappings = mappings.filter(mapping => !('fieldName' in mapping));
    if (attributeMappings.length > 1) {
      Sentry.captureException(
        new Error(
          `Multiple attribute mappings found for dataset: ${dataset}, selectors: ${mappings.map(mapping => mapping.regex).join(', ')}`
        )
      );
    }
    return attributeMappings[0] ?? null;
  }

  getDataset(): AllowedDataScrubbingDatasets {
    return this.dataset;
  }

  getSelector() {
    return this.selector;
  }

  toField(): string | null {
    const staticFields = TraceItemFieldSelector.getAllStaticFields(this.dataset);
    const staticFieldMatch = staticFields.find(mapping =>
      this.selector.match(mapping.regex)
    );
    if (staticFieldMatch) {
      return staticFieldMatch.fieldName;
    }
    const attributeMapping = TraceItemFieldSelector.getAttributeMapping(this.dataset);
    if (attributeMapping) {
      const match = this.selector.match(attributeMapping.regex);
      if (match?.[1]) {
        return match[1];
      }
    }

    Sentry.captureException(
      new Error(
        `Failed to get field from selector: ${this.selector}, dataset: ${this.dataset}`
      )
    );

    return null;
  }

  /**
   * Unlike toField, this returns a label, so it may do additional work like stripping 'sentry.' prefixes if it encounters thems.
   *
   * This should only be used for display purposes and never fed back into the form.
   */
  toLabel(): string {
    const field = this.toField();
    if (!field) {
      return '';
    }
    return field.replace(/^sentry\./, '');
  }

  static fromField(
    dataset: AllowedDataScrubbingDatasets,
    field: string
  ): TraceItemFieldSelector | null {
    if (!field) {
      return null;
    }
    const selector = TraceItemFieldSelector.fieldToSelectorMap[dataset](field);
    if (!selector) {
      return null;
    }
    return new TraceItemFieldSelector(selector, dataset);
  }

  static selectorToSourceLabel(
    dataset: AllowedDataScrubbingDatasets,
    selector: string
  ): string {
    const nonAttributeFields = TraceItemFieldSelector.fromNonAttributeFields(dataset);
    if (nonAttributeFields) {
      const field = nonAttributeFields.find(f => f.selector === selector);
      if (field) {
        return field.key;
      }
    }

    const prefix = TraceItemFieldSelector.datasetSelectorMap[dataset];
    if (prefix && selector.startsWith(prefix)) {
      // Extract attribute key from selector like "$log.attributes.'key'.value"
      const attributeMapping = TraceItemFieldSelector.getAttributeMapping(dataset);
      if (attributeMapping) {
        const match = selector.match(attributeMapping.regex);
        if (match?.[1]) {
          return match[1];
        }
      }
    }

    return selector;
  }

  static fromTraceItemResults(
    dataset: AllowedDataScrubbingDatasets,
    attributes: ReturnType<typeof useTraceItemAttributeKeys>['attributes']
  ): Array<{key: string; label: string; selector: string}> | null {
    if (!attributes) {
      Sentry.captureException(
        new Error('Attribute results should always contain attributes')
      );
      return null;
    }
    return Object.entries(attributes).map(([_, attribute]) => {
      const selector = TraceItemFieldSelector.fromField(dataset, attribute.key);
      return {
        key: attribute.key,
        label: selector?.toLabel() ?? attribute.name,
        selector: selector?.getSelector() ?? attribute.key,
      };
    });
  }

  static fromNonAttributeFields(dataset: AllowedDataScrubbingDatasets): Array<{
    key: string;
    label: string;
    selector: string;
  }> | null {
    const nonAttributeFields: Record<
      AllowedDataScrubbingDatasets,
      Array<{
        key: string;
        label: string;
        selector: string;
      }> | null
    > = {
      [AllowedDataScrubbingDatasets.LOGS]: [
        {
          selector: '$log.body',
          key: 'body',
          label: t('body'),
        },
      ],
      [AllowedDataScrubbingDatasets.DEFAULT]: null,
    };
    if (
      dataset === AllowedDataScrubbingDatasets.DEFAULT ||
      !nonAttributeFields[dataset]
    ) {
      Sentry.captureException(
        new Error('Non-attribute fields should not be used for event selectors')
      );
      return null;
    }
    return nonAttributeFields[dataset];
  }
}

/**
 * Validates that a TraceItemFieldSelector can be properly converted to a field and back
 * to ensure the regex transform inversions are working correctly.
 */
export function validateTraceItemFieldSelector(
  traceItemFieldSelector: TraceItemFieldSelector
): {
  isValid: boolean;
  error?: string;
} {
  try {
    const field = traceItemFieldSelector.toField();
    if (!field) {
      return {
        isValid: false,
        error: t('Unable to extract field from selector'),
      };
    }

    const dataset = traceItemFieldSelector.getDataset();
    const reconstructedSelector = TraceItemFieldSelector.fromField(dataset, field);
    if (!reconstructedSelector) {
      return {
        isValid: false,
        error: t('Unable to reconstruct selector from field'),
      };
    }

    const originalSelector = traceItemFieldSelector.getSelector();
    const reconstructedSelectorString = reconstructedSelector.getSelector();

    if (originalSelector !== reconstructedSelectorString) {
      return {
        isValid: false,
        error: t(
          'Selector transform inconsistency: %s !== %s',
          originalSelector,
          reconstructedSelectorString
        ),
      };
    }

    return {isValid: true};
  } catch (error) {
    return {
      isValid: false,
      error: t(
        'Validation error: %s',
        error instanceof Error ? error.message : String(error)
      ),
    };
  }
}
