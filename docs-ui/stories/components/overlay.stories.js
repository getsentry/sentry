import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';
import {AnimatePresence} from 'framer-motion';

import DropdownButton from 'sentry/components/dropdownButton';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import space from 'sentry/styles/space';
import useOverlay from 'sentry/utils/useOverlay';

export default {
  title: 'Components/Buttons/Dropdowns/Overlay',
  args: {
    offset: 8,
    position: 'bottom',
    animated: true,
  },
  argTypes: {
    position: {
      options: [
        'top',
        'bottom',
        'left',
        'right',
        'top-start',
        'top-end',
        'bottom-start',
        'bottom-end',
        'left-start',
        'left-end',
        'right-start',
        'right-end',
      ],
      control: {type: 'radio'},
    },
  },
};

export const _Overlay = ({animated, ...args}) => {
  const {isOpen, triggerProps, overlayProps, arrowProps} = useOverlay(args);
  const theme = useTheme();

  return (
    <div>
      <DropdownButton {...triggerProps}>Show Overlay</DropdownButton>
      <AnimatePresence>
        {isOpen && (
          <FocusScope contain restoreFocus autoFocus>
            <PositionWrapper zIndex={theme.zIndex.dropdown} {...overlayProps}>
              <StyledOverlay arrowProps={arrowProps} animated={animated}>
                <TextSample>Overlay Content</TextSample>
              </StyledOverlay>
            </PositionWrapper>
          </FocusScope>
        )}
      </AnimatePresence>
    </div>
  );
};

const StyledOverlay = styled(Overlay)`
  padding: ${space(1)} ${space(1.5)};
`;

const TextSample = styled('p')`
  margin: 0;
  color: ${p => p.theme.subText};
`;
