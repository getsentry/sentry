import {Fragment} from 'react';
import styled from '@emotion/styled';

import {KeyValueTable} from 'sentry/components/keyValueTable';
import TagsTableRow from 'sentry/components/tagsTableRow';
import space from 'sentry/styles/space';
import {formatBytesBase2} from 'sentry/utils';
import {formatPercentage} from 'sentry/utils/formatters';
import {MODULES_WITH_SIZE} from 'sentry/views/replays/detail/unusedModules/utils';

function MetaTable({
  usedModules,
  unusedModules,
}: {
  unusedModules: string[];
  usedModules: string[];
}) {
  const totalModules = unusedModules.length + usedModules.length;
  const percentInUse = formatPercentage(usedModules.length / totalModules);

  const extraWeight = unusedModules
    .map(moduleName => MODULES_WITH_SIZE[moduleName] || 0)
    .reduce((sum, n) => sum + n, 0);
  const usedWeight = usedModules
    .map(moduleName => MODULES_WITH_SIZE[moduleName] || 0)
    .reduce((sum, n) => sum + n, 0);

  const query = '';
  const generateUrl = () => '';

  const leftValues = [
    ['Accessed Modules', String(usedModules.length)],
    ['Unused Modules', String(unusedModules.length)],
    ['Percent Accessed', percentInUse],
  ];
  const rightValues = [
    ['Accessed Weight', formatBytesBase2(usedWeight)],
    ['Unused Weight', formatBytesBase2(extraWeight)],
    ['\u00A0', '\u00A0'],
  ];

  return (
    <Fragment>
      <SideSplit>
        <KeyValueTable>
          {leftValues.map(([key, value]) => (
            <TagsTableRow
              key={key}
              tag={{key, value}}
              query={query}
              generateUrl={generateUrl}
            />
          ))}
        </KeyValueTable>
        <KeyValueTable>
          {rightValues.map(([key, value]) => (
            <TagsTableRow
              key={key}
              tag={{key, value}}
              query={query}
              generateUrl={generateUrl}
            />
          ))}
        </KeyValueTable>
      </SideSplit>
    </Fragment>
  );
}

const SideSplit = styled('div')`
  display: flex;
  flex-direction: row;
  width: 100%;
  gap: ${space(2)};

  ${KeyValueTable} {
    flex-grow: 1;
    margin-bottom: 0;
  }
`;

export default MetaTable;
