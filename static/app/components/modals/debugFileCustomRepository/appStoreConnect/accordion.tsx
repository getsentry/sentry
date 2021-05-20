import React, {useState} from 'react';
import styled from '@emotion/styled';

import ListItem from 'app/components/list/listItem';
import {Panel} from 'app/components/panels';
import {IconChevron} from 'app/icons';
import space from 'app/styles/space';

type Props = {
  summary: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
};

function Accordion({summary, defaultExpanded, children}: Props) {
  const [isExpanded, setIsExpanded] = useState(!!defaultExpanded);

  return (
    <ListItem>
      <StyledPanel>
        <Summary onClick={() => setIsExpanded(!isExpanded)}>
          {summary}
          <IconChevron direction={isExpanded ? 'down' : 'right'} color="gray400" />
        </Summary>
        {isExpanded && <Details>{children}</Details>}
      </StyledPanel>
    </ListItem>
  );
}

export default Accordion;

const StyledPanel = styled(Panel)`
  padding: ${space(1.5)};
  margin-bottom: 0;
`;

const Summary = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  grid-gap: ${space(1)};
  cursor: pointer;
  padding-left: calc(${space(3)} + ${space(1)});
  align-items: center;
`;

const Details = styled('div')`
  padding-top: ${space(1.5)};
`;
