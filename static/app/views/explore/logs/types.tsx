type OurLogCustomFieldKey = string; // We could brand this for nominal types.

export enum OurLogKnownFieldKey {
  ID = 'id',
  BODY = 'log.body',
  SEVERITY_NUMBER = 'log.severity_number',
  SEVERITY_TEXT = 'log.severity_text',
  ORGANIZATION_ID = 'sentry.organization_id',
  PROJECT_ID = 'sentry.project_id',
  SPAN_ID = 'sentry.span_id',
  TIMESTAMP = 'timestamp',
}

export type OurLogFieldKey = OurLogCustomFieldKey | OurLogKnownFieldKey;

export type OurLogsKnownFieldResponseMap = {
  [OurLogKnownFieldKey.BODY]: string;
  [OurLogKnownFieldKey.SEVERITY_NUMBER]: number;
  [OurLogKnownFieldKey.SEVERITY_TEXT]: string;
  [OurLogKnownFieldKey.ORGANIZATION_ID]: number;
  [OurLogKnownFieldKey.PROJECT_ID]: number;
  [OurLogKnownFieldKey.SPAN_ID]: string;
  [OurLogKnownFieldKey.TIMESTAMP]: string;
};

type OurLogsCustomFieldResponseMap = Record<OurLogCustomFieldKey, string | number>;

export type OurLogsResponseItem = OurLogsKnownFieldResponseMap &
  OurLogsCustomFieldResponseMap;
