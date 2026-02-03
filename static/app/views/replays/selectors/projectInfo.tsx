import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {Tooltip} from '@sentry/scraps/tooltip';

import TextOverflow from 'sentry/components/textOverflow';
import {space} from 'sentry/styles/space';
import useProjects from 'sentry/utils/useProjects';

export default function ProjectInfo({id, isWidget}: {id: number; isWidget: boolean}) {
  const {projects} = useProjects();
  const project = projects.find(p => p.id === id.toString());
  const platform = project?.platform;
  const slug = project?.slug;
  return isWidget ? (
    <WidgetProjectContainer>
      <Tooltip title={slug}>
        <PlatformIcon size={16} platform={platform ?? 'default'} />
      </Tooltip>
    </WidgetProjectContainer>
  ) : (
    <IndexProjectContainer>
      <PlatformIcon size={16} platform={platform ?? 'default'} />
      <TextOverflow>{slug}</TextOverflow>
    </IndexProjectContainer>
  );
}

const WidgetProjectContainer = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${space(0.75)};
`;

const IndexProjectContainer = styled(WidgetProjectContainer)`
  padding-right: ${space(1)};
`;
