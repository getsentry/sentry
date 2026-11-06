import moment from 'moment-timezone';

import {Disclosure} from '@sentry/scraps/disclosure';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ResultGrid} from 'sentry/components/resultGrid';
import {SimpleTable} from 'sentry/components/tables/simpleTable';

import {displayPriceWithCents} from 'getsentry/utils/billing';

type ContractDate = {day?: number; month?: number; year?: number};

type LineItemDetails = {customerFacingName?: string; uid?: string};

type UserConfig = {
  activation?: Record<string, unknown>;
  allItems?: Record<string, never>;
  paygBudget?: {budgetCents?: string};
  reservation?: {
    isUnlimited?: boolean;
    numReservedUnits?: string;
    reservedPriceCents?: string;
  };
  softCap?: {type?: string};
  specificItems?: {uids?: string[]};
  spendAllocation?: {projectId?: string; quantity?: string};
};

type RetentionConfig = {
  organizationDays?: number;
  overrides?: Array<{
    category?: string;
    downsampledDays?: number;
    standardDays?: number;
  }>;
};

type PlatformContract = {
  billingConfig?: {
    creditCard?: Record<string, never>;
    invoiced?: {payg?: {charged?: boolean}};
    monthInterval?: number;
    partner?: {billingStrategy?: string; selfServe?: boolean};
    sponsorshipConfig?: {sponsorshipType?: string};
  };
  metadata?: {id?: string; packageUid?: string; previousId?: string};
  pricingConfig?: {
    ondemandPeriodEndDate?: ContractDate;
    ondemandPeriodStartDate?: ContractDate;
    userConfig?: UserConfig[];
  };
  retentionConfig?: RetentionConfig;
};

type PackageConfig = {
  adminTitle?: string;
  flexibleBasePriceCents?: {base?: string; fixed?: string};
  lineItemConfigs?: Array<{
    isOptionalAddOn?: boolean;
    isUnlimited?: boolean;
    lineItem?: LineItemDetails;
    numReservedUnits?: string;
  }>;
  sharedLineItemPools?: Array<{
    isOptionalAddOn?: boolean;
    lineItems?: LineItemDetails[];
    sharedLineItem?: LineItemDetails;
  }>;
  title?: string;
  uid?: string;
};

type ContractRow = {
  contract: PlatformContract;
  package: PackageConfig | null;
};

function formatDate(d?: ContractDate): string {
  if (!d?.year || !d?.month || !d?.day) {
    return 'N/A';
  }
  return moment({year: d.year, month: d.month - 1, day: d.day}).format('ll');
}

function formatEnum(value: string | undefined, prefix: string): string {
  if (!value) {
    return 'N/A';
  }
  return (value.startsWith(prefix) ? value.slice(prefix.length) : value)
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatCents(cents?: string): string {
  return displayPriceWithCents({cents: Number(cents ?? 0)});
}

function formatUnits(isUnlimited?: boolean, units?: string): string {
  return isUnlimited ? 'Unlimited' : Number(units ?? 0).toLocaleString();
}

function lineItemNames(pkg: PackageConfig | null): Map<string, string> {
  const names = new Map<string, string>();
  const add = (item?: LineItemDetails) => {
    if (item?.uid) {
      names.set(item.uid, item.customerFacingName || item.uid);
    }
  };
  pkg?.lineItemConfigs?.forEach(config => add(config.lineItem));
  pkg?.sharedLineItemPools?.forEach(pool => add(pool.sharedLineItem));
  return names;
}

function describeBilling(contract: PlatformContract): string {
  const config = contract.billingConfig;
  const interval = config?.monthInterval === 12 ? 'Annual' : 'Monthly';
  let type = 'N/A';
  if (config?.creditCard) {
    type = 'Credit Card';
  } else if (config?.invoiced) {
    type = config.invoiced.payg
      ? `Invoiced (PAYG ${config.invoiced.payg.charged ? 'charged' : 'manual'})`
      : 'Invoiced';
  } else if (config?.partner) {
    type = `Partner: ${formatEnum(config.partner.billingStrategy, 'PARTNER_BILLING_STRATEGY_')}`;
  }
  const sponsorship = config?.sponsorshipConfig
    ? `, Sponsored: ${formatEnum(config.sponsorshipConfig.sponsorshipType, 'SPONSORED_TYPE_')}`
    : '';
  return `${type}, ${interval}${sponsorship}`;
}

function describeUserConfig(config: UserConfig, names: Map<string, string>): string {
  let change = 'Unknown override';
  if (config.paygBudget) {
    change = `PAYG budget ${formatCents(config.paygBudget.budgetCents)}`;
  } else if (config.reservation) {
    const {isUnlimited, numReservedUnits, reservedPriceCents} = config.reservation;
    change = `Reserved ${formatUnits(isUnlimited, numReservedUnits)} for ${formatCents(reservedPriceCents)}`;
  } else if (config.activation) {
    change = 'Activated';
  } else if (config.softCap) {
    change = `Soft cap: ${formatEnum(config.softCap.type, 'SOFT_CAP_TYPE_')}`;
  } else if (config.spendAllocation) {
    const {quantity, projectId} = config.spendAllocation;
    change = `Spend allocation ${Number(quantity ?? 0).toLocaleString()} to project ${projectId}`;
  }
  const items = config.specificItems
    ? (config.specificItems.uids ?? []).map(uid => names.get(uid) ?? uid).join(', ')
    : 'All line items';
  return `${items}: ${change}`;
}

function describeRetention(retention?: RetentionConfig): string[] {
  const lines: string[] = [];
  if (retention?.organizationDays !== undefined) {
    lines.push(`Organization retention: ${retention.organizationDays} days`);
  }
  retention?.overrides?.forEach(override => {
    const days = [
      override.standardDays === undefined
        ? null
        : `${override.standardDays} days standard`,
      override.downsampledDays === undefined
        ? null
        : `${override.downsampledDays} days downsampled`,
    ].filter(Boolean);
    lines.push(
      `${formatEnum(override.category, 'DATA_CATEGORY_')} retention: ${days.join(', ')}`
    );
  });
  return lines;
}

function Overrides({row}: {row: ContractRow}) {
  const names = lineItemNames(row.package);
  const overrides = [
    ...(row.contract.pricingConfig?.userConfig ?? []).map(config =>
      describeUserConfig(config, names)
    ),
    ...describeRetention(row.contract.retentionConfig),
  ];
  if (overrides.length === 0) {
    return <Text variant="muted">None</Text>;
  }
  return (
    <Stack gap="xs">
      {overrides.map((override, idx) => (
        <Text key={idx}>{override}</Text>
      ))}
    </Stack>
  );
}

function Package({row}: {row: ContractRow}) {
  const pkg = row.package;
  if (!pkg) {
    return (
      <Text variant="danger">Unknown package {row.contract.metadata?.packageUid}</Text>
    );
  }
  return (
    <Disclosure>
      <Disclosure.Title>
        {pkg.adminTitle || pkg.title} ({formatCents(pkg.flexibleBasePriceCents?.base)})
      </Disclosure.Title>
      <Disclosure.Content>
        <Stack gap="xs">
          <Text size="sm" variant="muted">
            {pkg.uid}
          </Text>
          {pkg.lineItemConfigs?.map(config => (
            <Text key={config.lineItem?.uid}>
              {config.lineItem?.customerFacingName}:{' '}
              {formatUnits(config.isUnlimited, config.numReservedUnits)} included
              {config.isOptionalAddOn ? ' (optional add-on)' : ''}
            </Text>
          ))}
          {pkg.sharedLineItemPools?.map(pool => (
            <Text key={pool.sharedLineItem?.uid}>
              {pool.sharedLineItem?.customerFacingName}: shared pool for{' '}
              {pool.lineItems?.map(item => item.customerFacingName).join(', ')}
              {pool.isOptionalAddOn ? ' (optional add-on)' : ''}
            </Text>
          ))}
        </Stack>
      </Disclosure.Content>
    </Disclosure>
  );
}

const getRow = (row: ContractRow) => [
  <SimpleTable.RowCell key="contract">{row.contract.metadata?.id}</SimpleTable.RowCell>,
  <SimpleTable.RowCell key="period">
    {formatDate(row.contract.pricingConfig?.ondemandPeriodStartDate)} ›{' '}
    {formatDate(row.contract.pricingConfig?.ondemandPeriodEndDate)}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="billing">
    {describeBilling(row.contract)}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="package">
    <Package row={row} />
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="overrides">
    <Overrides row={row} />
  </SimpleTable.RowCell>,
];

export function CustomerContracts({orgId}: {orgId: string}) {
  return (
    <ResultGrid
      inPanel
      panelTitle="Billing Platform Contracts"
      path={`/_admin/customers/${orgId}/`}
      endpoint={`/_admin/customers/${orgId}/contracts/`}
      defaultParams={{per_page: 10}}
      useQueryString={false}
      columns={[
        {key: 'contract', label: 'Contract', width: 100},
        {key: 'period', label: 'Period', width: 220},
        {key: 'billing', label: 'Billing', width: 200},
        {key: 'package', label: 'Package'},
        {key: 'overrides', label: 'Overrides'},
      ]}
      keyForRow={(row: ContractRow) => row.contract.metadata?.id ?? ''}
      columnsForRow={getRow}
    />
  );
}
