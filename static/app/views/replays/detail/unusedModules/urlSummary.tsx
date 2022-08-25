import {Fragment} from 'react';
import styled from '@emotion/styled';

import {KeyValueTable} from 'sentry/components/keyValueTable';
import TagsTableRow from 'sentry/components/tagsTableRow';
import space from 'sentry/styles/space';
import {formatBytesBase2} from 'sentry/utils';
import {MODULES_WITH_SIZE} from 'sentry/views/replays/detail/unusedModules/utils';

function UrlSummary({
  usedModules,
  unusedModules,
  url,
}: {
  unusedModules: string[];
  url: string;
  usedModules: string[];
}) {
  const totalModules = unusedModules.length + usedModules.length;
  const percentInUse = Math.round((usedModules.length / totalModules) * 10000) / 100;

  const extraWeight = unusedModules
    .map(moduleName => MODULES_WITH_SIZE[moduleName])
    .reduce((sum, n) => sum + n, 0);

  const query = '';
  const generateUrl = () => '';

  const leftValues = [
    ['Modules Imported', String(totalModules)],
    ['Unused Modules', String(unusedModules.length)],
  ];
  const rightValues = [
    ['Percent Accessed', `${percentInUse}%`],
    ['Unused Weight', formatBytesBase2(extraWeight)],
  ];

  return (
    <Fragment>
      <div>{url}</div>
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

export default UrlSummary;
