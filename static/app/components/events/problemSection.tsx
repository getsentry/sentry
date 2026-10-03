import type {ReactNode} from 'react';
import type {LocationDescriptor} from 'history';

import {Alert} from '@sentry/scraps/alert';
import {InfoTip} from '@sentry/scraps/info';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {KeyValueTableDataRow} from 'sentry/components/tables/keyValueTable';
import {ValueLink} from 'sentry/components/tables/keyValueTable/value';

export interface ProblemSectionField {
  key: string;
  label: string;
  value: ReactNode;
  emphasized?: boolean;
  link?: LocationDescriptor;
  tooltip?: ReactNode;
}

interface ProblemSectionProps {
  fields: readonly ProblemSectionField[];
  summary: ReactNode;
  children?: ReactNode;
}

/**
 * Present a problem explanation and its supporting facts. Callers own data
 * loading, formatting, visibility, and the surrounding collapsible section.
 */
export function ProblemSection({summary, fields, children}: ProblemSectionProps) {
  return (
    <Stack gap="lg">
      <Alert variant="muted" showIcon>
        {summary}
      </Alert>
      {fields.length > 0 && (
        <Grid columns="fit-content(50%) 1fr" border="primary" radius="md" padding="sm">
          {fields.map(field => {
            const value = (
              <Text as="div" monospace bold={field.emphasized} variant="inherit">
                {field.value}
              </Text>
            );

            return (
              <KeyValueTableDataRow
                key={field.key}
                disableFormattedData
                item={{
                  key: field.key,
                  subject: field.label,
                  value: (
                    <Flex align="center" gap="xs" minWidth={0}>
                      {field.link ? (
                        <ValueLink to={field.link}>{value}</ValueLink>
                      ) : (
                        value
                      )}
                      {field.tooltip && <InfoTip size="xs" title={field.tooltip} />}
                    </Flex>
                  ),
                }}
              />
            );
          })}
        </Grid>
      )}
      {children}
    </Stack>
  );
}
