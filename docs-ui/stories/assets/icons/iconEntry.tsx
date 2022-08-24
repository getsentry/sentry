import styled from '@emotion/styled';

import {Hovercard} from 'sentry/components/hovercard';
import space from 'sentry/styles/space';

import Details from './details';
import IconSample from './sample';
import {ExtendedIconData} from './searchPanel';

type Props = {
  icon: ExtendedIconData;
};

const IconEntry = ({icon}: Props) => {
  return (
    <Hovercard body={<Details icon={icon} />}>
      <BoxWrap>
        <IconSample name={icon.name} size="sm" color="gray500" {...icon.defaultProps} />
        <Name>{icon.name}</Name>
      </BoxWrap>
    </Hovercard>
  );
};

export default IconEntry;

const BoxWrap = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  padding: ${space(1)};
  border: solid 1px transparent;
  border-radius: ${p => p.theme.borderRadius};
  cursor: pointer;

  svg {
    flex-shrink: 0;
    width: 24px;
  }

  &:hover {
    border-color: ${p => p.theme.innerBorder};
  }
`;

const Name = styled('p')`
  position: relative;
  line-height: 1;
  margin-bottom: 0;
  font-size: ${p => p.theme.fontSizeMedium};
  text-transform: capitalize;
`;
