import styled from '@emotion/styled';

import {ActivityLineContent} from './layout';

interface ActivityLineBodyProps {
  subtext?: React.ReactNode;
}

export function ActivityLineBody({subtext}: ActivityLineBodyProps) {
  if (!subtext) {
    return null;
  }

  return (
    <ActivityLineContent>
      <ActivityLineSubtext>{subtext}</ActivityLineSubtext>
    </ActivityLineContent>
  );
}

const ActivityLineSubtext = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
  line-height: 1.4;
  overflow-wrap: anywhere;
  word-break: break-word;
`;
