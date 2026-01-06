import {t} from 'sentry/locale';

import type {BillingDetails} from 'getsentry/types';

type TaxFieldInfo = {
  label: string;
  placeholder: string;
  taxNumberName: string;
};

const getTaxFieldInfo = (countryCode?: BillingDetails['countryCode']): TaxFieldInfo =>
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  countryCode ? SALES_TAX_COUNTRY_INFO[countryCode] || taxInfo.DEFAULT : taxInfo.DEFAULT;

const countryHasSalesTax = (countryCode?: BillingDetails['countryCode']): boolean =>
  countryCode ? countryCode in SALES_TAX_COUNTRY_INFO : false;

const taxInfo = {
  ABN: {
    label: t('ABN'),
    placeholder: t('ABN'),
    taxNumberName: t('Australian Business Number'),
  },
  BRN: {
    label: t('BRN'),
    placeholder: t('BRN'),
    taxNumberName: t('Business Registration Number'),
  },
  GST: {
    label: t('GST Number'),
    placeholder: t('GST number'),
    taxNumberName: t('Goods and Services Tax Number'),
  },
  GSTHST: {
    label: t('GST/HST Number'),
    placeholder: t('GST/HST number'),
    taxNumberName: t('Goods and Services or Harmonized Sales Tax Number'),
  },
  GUIUBN: {
    label: t('GUI/UBN Number'),
    placeholder: t('GUI/UBN number'),
    taxNumberName: t('Government Unified Invoices or Unified Business Number'),
  },
  CT: {
    label: t('CT Number'),
    placeholder: t('CT number'),
    taxNumberName: t('Consumption Tax Number'),
  },
  TIN: {
    label: t('TIN'),
    placeholder: t('TIN'),
    taxNumberName: t('Taxpayer Identification Number'),
  },
  TRN: {
    label: t('TRN'),
    placeholder: t('TRN'),
    taxNumberName: t('Taxpayer Registration Number'),
  },
  VAT: {
    label: t('VAT Number'),
    placeholder: t('VAT number'),
    taxNumberName: t('Value-Added Tax Number'),
  },
  DEFAULT: {
    label: t('Tax Number'),
    placeholder: t('Tax number'),
    taxNumberName: t('Tax Identification Number'),
  },
} satisfies Record<NonNullable<BillingDetails['countryCode']>, TaxFieldInfo>;

const SALES_TAX_COUNTRY_INFO = {
  AE: taxInfo.TRN,
  AT: taxInfo.VAT,
  AU: taxInfo.ABN,
  BE: taxInfo.VAT,
  BG: taxInfo.VAT,
  CA: taxInfo.GSTHST,
  CL: taxInfo.TIN,
  CY: taxInfo.VAT,
  CZ: taxInfo.VAT,
  DE: taxInfo.VAT,
  DK: taxInfo.VAT,
  EE: taxInfo.VAT,
  ES: taxInfo.VAT,
  FI: taxInfo.VAT,
  FR: taxInfo.VAT,
  GB: taxInfo.VAT,
  GE: taxInfo.VAT,
  GR: taxInfo.VAT,
  HR: taxInfo.VAT,
  HU: taxInfo.VAT,
  IE: taxInfo.VAT,
  IN: taxInfo.VAT,
  IS: taxInfo.VAT,
  IT: taxInfo.VAT,
  JP: taxInfo.CT,
  KR: taxInfo.BRN,
  LT: taxInfo.VAT,
  LU: taxInfo.VAT,
  LV: taxInfo.VAT,
  MT: taxInfo.VAT,
  NL: taxInfo.VAT,
  NO: taxInfo.VAT,
  PH: taxInfo.TIN,
  PL: taxInfo.VAT,
  PT: taxInfo.VAT,
  RO: taxInfo.VAT,
  SA: taxInfo.VAT,
  SE: taxInfo.VAT,
  SG: taxInfo.GST,
  SI: taxInfo.VAT,
  SK: taxInfo.VAT,
  TH: taxInfo.VAT,
  TR: taxInfo.VAT,
  TW: taxInfo.GUIUBN,
};

const REGION_BY_COUNTRY_CODE = {
  US: {
    AL: 'Alabama',
    AK: 'Alaska',
    AS: 'American Samoa',
    AZ: 'Arizona',
    AR: 'Arkansas',
    CA: 'California',
    CO: 'Colorado',
    CT: 'Connecticut',
    DE: 'Delaware',
    FL: 'Florida',
    GA: 'Georgia',
    GU: 'Guam',
    HI: 'Hawaii',
    ID: 'Idaho',
    IL: 'Illinois',
    IN: 'Indiana',
    IA: 'Iowa',
    KS: 'Kansas',
    KY: 'Kentucky',
    LA: 'Louisiana',
    ME: 'Maine',
    MD: 'Maryland',
    MA: 'Massachusetts',
    MI: 'Michigan',
    FM: 'Micronesia',
    MN: 'Minnesota',
    MS: 'Mississippi',
    MO: 'Missouri',
    MT: 'Montana',
    NE: 'Nebraska',
    NV: 'Nevada',
    NH: 'New Hampshire',
    NJ: 'New Jersey',
    NM: 'New Mexico',
    NY: 'New York',
    NC: 'North Carolina',
    ND: 'North Dakota',
    MP: 'Northern Mariana Islands',
    OH: 'Ohio',
    OK: 'Oklahoma',
    OR: 'Oregon',
    PA: 'Pennsylvania',
    PR: 'Puerto Rico',
    RI: 'Rhode Island',
    SC: 'South Carolina',
    SD: 'South Dakota',
    TN: 'Tennessee',
    TX: 'Texas',
    UT: 'Utah',
    VI: 'Virgin Islands',
    VT: 'Vermont',
    VA: 'Virginia',
    WA: 'Washington',
    DC: 'Washington DC',
    WV: 'West Virginia',
    WI: 'Wisconsin',
    WY: 'Wyoming',
  },
  CA: {
    AB: 'Alberta',
    BC: 'British Columbia',
    MB: 'Manitoba',
    NB: 'New Brunswick',
    NL: 'Newfoundland and Labrador',
    NT: 'Northwest Territories',
    NS: 'Nova Scotia',
    NU: 'Nunavut',
    ON: 'Ontario',
    PE: 'Prince Edward Island',
    QC: 'Quebec',
    SK: 'Saskatchewan',
    YT: 'Yukon',
  },
};

function countryHasRegionChoices(
  countryCode?: BillingDetails['countryCode']
): countryCode is string {
  return !!countryCode && countryCode in REGION_BY_COUNTRY_CODE;
}

function getRegionChoices(countryCode?: BillingDetails['countryCode']) {
  return countryHasRegionChoices(countryCode)
    ? // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      Object.entries(REGION_BY_COUNTRY_CODE[countryCode])
    : [];
}

function getRegionChoiceCode(
  countryCode?: BillingDetails['countryCode'],
  region?: BillingDetails['region']
) {
  return countryHasRegionChoices(countryCode) &&
    !!region &&
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    region in REGION_BY_COUNTRY_CODE[countryCode]
    ? region
    : undefined;
}

export {
  countryHasRegionChoices,
  countryHasSalesTax,
  getRegionChoices,
  getRegionChoiceCode,
  getTaxFieldInfo,
  type TaxFieldInfo,
};
