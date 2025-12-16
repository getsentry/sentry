import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {Flex} from '@sentry/scraps/layout';

import {Tooltip} from 'sentry/components/core/tooltip';
import TextOverflow from 'sentry/components/textOverflow';
import {space} from 'sentry/styles/space';
import useProjects from 'sentry/utils/useProjects';

export default function ProjectInfo({id, isWidget}: {id: number; isWidget: boolean}) {
  const {projects} = useProjects();
  const project = projects.find(p => p.id === id.toString());
  const platform = project?.platform;
  const slug = project?.slug;
  return isWidget ? (
    <Flex align="center" gap="0.75">
      <Tooltip title={slug}>
        <PlatformIcon size={16} platform={platform ?? 'default'} />
      </Tooltip>
    </Flex>
  ) : (
    <IndexProjectContainer>
      <PlatformIcon size={16} platform={platform ?? 'default'} />
      <TextOverflow>{slug}</TextOverflow>
    </IndexProjectContainer>
  );
}

const IndexProjectContainer = styled(WidgetProjectContainer)`
  padding-right: ${space(1)};
`;
