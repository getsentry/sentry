import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import CompactSelect from 'sentry/components/forms/compactSelect';
import {Panel} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import {BreadcrumbLevelType, BreadcrumbTypeDefault} from 'sentry/types/breadcrumbs';

import ConsoleMessage from './consoleMessage';

interface Props {
  breadcrumbs: BreadcrumbTypeDefault[];
}

const getDistinctLogLevels = breadcrumbs =>
  Array.from(new Set(breadcrumbs.map(breadcrumb => breadcrumb.level)));

function Console({breadcrumbs}: Props) {
  const [logLevel, setLogLevel] = useState<BreadcrumbLevelType>();

  const filteredBreadcrumbs = useMemo(
    () =>
      !logLevel
        ? breadcrumbs
        : breadcrumbs.filter(breadcrumb => breadcrumb.level === logLevel),
    [logLevel, breadcrumbs]
  );

  return (
    <Fragment>
      <CompactSelect
        triggerProps={{
          size: 'small',
          prefix: t('Log Level'),
        }}
        value={logLevel}
        options={getDistinctLogLevels(breadcrumbs).map(breadcrumbLogLevel => ({
          value: breadcrumbLogLevel,
          label: `${breadcrumbLogLevel}`,
          disabled: breadcrumbLogLevel === logLevel,
        }))}
        onChange={opt => setLogLevel(opt.value)}
      />
      <ConsoleTable>
        {filteredBreadcrumbs.map((breadcrumb, i) => (
          <ConsoleMessage
            key={i}
            isLast={i === breadcrumbs.length - 1}
            breadcrumb={breadcrumb}
          />
        ))}
      </ConsoleTable>
    </Fragment>
  );
}

const ConsoleTable = styled(Panel)`
  display: grid;
  grid-template-columns: max-content auto;
  font-family: ${p => p.theme.text.familyMono};
  font-size: 0.8em;
`;

export default Console;
