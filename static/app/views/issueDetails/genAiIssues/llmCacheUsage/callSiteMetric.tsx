import {InfoTip} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {KeyValueData} from 'sentry/components/keyValueData';

interface CallSiteMetricProps {
  id: string;
  label: string;
  value: string;
  /**
   * Set on the figure the finding turns on, so the row that explains the issue
   * stands out from the ones that merely describe the call site.
   */
  emphasized?: boolean;
  tooltip?: string;
}

/**
 * One measured figure about the call site, as a row of the diagnostics grid.
 */
export function CallSiteMetric({
  id,
  label,
  value,
  emphasized,
  tooltip,
}: CallSiteMetricProps) {
  return (
    <KeyValueData.Content
      disableFormattedData
      item={{
        key: id,
        subject: label,
        value: (
          <Flex align="center" gap="xs">
            <Text monospace bold={emphasized}>
              {value}
            </Text>
            {tooltip && <InfoTip size="xs" title={tooltip} />}
          </Flex>
        ),
      }}
    />
  );
}
