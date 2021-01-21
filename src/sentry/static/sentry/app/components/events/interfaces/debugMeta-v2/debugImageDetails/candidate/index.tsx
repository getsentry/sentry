import React from 'react';
import styled from '@emotion/styled';
import PropTypes from 'prop-types';

import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import {BuiltinSymbolSource} from 'app/types/debugFiles';
import {ImageCandidate} from 'app/types/debugImage';

import {INTERNAL_SOURCE} from '../utils';

import Actions from './actions';
import Features from './features';
import Processings from './processings';
import Status from './status';
import {getSourceTooltipDescription} from './utils';

type Props = {
  candidate: ImageCandidate;
  builtinSymbolSources: Array<BuiltinSymbolSource> | null;
  organization: Organization;
  projectId: Project['slug'];
  baseUrl: string;
  onDelete: (debugFileId: string) => void;
};

function Candidate({
  candidate,
  builtinSymbolSources,
  organization,
  projectId,
  baseUrl,
  onDelete,
}: Props) {
  const {location, download, source_name, source} = candidate;
  const isInternalSource = source === INTERNAL_SOURCE;

  return (
    <React.Fragment>
      <Column>
        <Status candidate={candidate} />
      </Column>

      <DebugFileColumn>
        <Tooltip title={getSourceTooltipDescription(source, builtinSymbolSources)}>
          <SourceName>{source_name ?? t('Unknown')}</SourceName>
        </Tooltip>
        {location && !isInternalSource && <Location>{location}</Location>}
      </DebugFileColumn>

      <Column>
        <Processings candidate={candidate} />
      </Column>

      <Column>
        <Features download={download} />
      </Column>

      <Column>
        {isInternalSource && (
          <Actions
            onDelete={onDelete}
            baseUrl={baseUrl}
            projectId={projectId}
            organization={organization}
            candidate={candidate}
          />
        )}
      </Column>
    </React.Fragment>
  );
}

export default Candidate;

Candidate.propTypes = {
  candidate: PropTypes.shape({
    download: PropTypes.shape({
      status: PropTypes.string.isRequired,
      features: PropTypes.object,
    }),
  }),
};

const Column = styled('div')`
  display: flex;
  align-items: center;
`;

// Debug File Info Column
const DebugFileColumn = styled(Column)`
  flex-direction: column;
  align-items: flex-start;
`;

const SourceName = styled('div')`
  color: ${p => p.theme.textColor};
  width: 100%;
  white-space: pre-wrap;
  word-break: break-all;
`;

const Location = styled(SourceName)`
  color: ${p => p.theme.gray300};
`;
