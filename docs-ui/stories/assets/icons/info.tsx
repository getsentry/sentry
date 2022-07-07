import {useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';
import Code from 'docs-ui/components/code';
import {AnimatePresence} from 'framer-motion';

import Button, {ButtonLabel} from 'sentry/components/button';
import SelectField from 'sentry/components/deprecatedforms/selectField';
import BooleanField from 'sentry/components/forms/booleanField';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import space from 'sentry/styles/space';
import useOverlay from 'sentry/utils/useOverlay';

import {iconProps} from './data';
import IconSample from './sample';
import {ExtendedIconData} from './searchPanel';

const IconInfo = ({icon}: {icon: ExtendedIconData}) => {
  const {isOpen, triggerProps, overlayProps, arrowProps} = useOverlay({
    position: 'bottom',
  });
  const theme = useTheme();

  /**
   * Editable icon props
   */
  const [size, setSize] = useState(iconProps.size.default);
  const [direction, setDirection] = useState(
    icon.defaultProps?.direction ?? iconProps.direction.default
  );
  const [type, setType] = useState(icon.defaultProps?.type ?? iconProps.type.default);
  const [isCircled, setIsCircled] = useState(icon.defaultProps?.isCircled ?? false);
  const [isSolid, setIsSolid] = useState(icon.defaultProps?.isSolid ?? false);

  /**
   * Generate and update code sample based on prop states
   */
  const codeSample = useMemo(
    () =>
      `<Icon${icon.name} color="gray500" size="${size}"${isCircled ? ' isCircled' : ' '}${
        isSolid ? ' isSolid' : ' '
      } />`,
    [icon.name, isCircled, isSolid, size]
  );

  return (
    <div>
      <BoxWrap borderless {...triggerProps}>
        <IconSample name={icon.name} size="sm" color="gray500" {...icon.defaultProps} />
        <Name>{icon.name}</Name>
      </BoxWrap>
      <AnimatePresence>
        {isOpen && (
          <FocusScope contain restoreFocus autoFocus>
            <PositionWrapper zIndex={theme.zIndex.dropdown} {...overlayProps}>
              <StyledOverlay arrowProps={arrowProps} animated>
                <SampleWrap>
                  <IconSample
                    name={icon.name}
                    size={size}
                    color="gray500"
                    {...(icon.additionalProps?.includes('type') ? {type} : {})}
                    {...(icon.additionalProps?.includes('direction') ? {direction} : {})}
                    {...(isCircled ? {isCircled} : {})}
                    {...(isSolid ? {isSolid} : {})}
                  />
                </SampleWrap>
                <SelectorWrap>
                  <SelectorLabel>Size</SelectorLabel>
                  <StyledSelectField
                    name="size"
                    defaultValue={size}
                    choices={iconProps.size.options}
                    onChange={value => setSize(value as string)}
                    clearable={false}
                  />
                </SelectorWrap>
                {icon.additionalProps?.includes('direction') && (
                  <SelectorWrap>
                    <SelectorLabel>Direction</SelectorLabel>
                    <StyledSelectField
                      name="direction"
                      defaultValue={direction}
                      choices={iconProps.direction.options}
                      onChange={value => setDirection(value as string)}
                      clearable={false}
                    />
                  </SelectorWrap>
                )}
                {icon.additionalProps?.includes('type') && (
                  <SelectorWrap>
                    <SelectorLabel>Type</SelectorLabel>
                    <StyledSelectField
                      name="type"
                      defaultValue={type}
                      choices={iconProps.type.options}
                      onChange={value => setType(value as string)}
                      clearable={false}
                    />
                  </SelectorWrap>
                )}
                {icon.additionalProps?.includes('isCircled') && (
                  <StyledBooleanField
                    name="isCircled"
                    label="Circled"
                    value={isCircled}
                    onChange={value => setIsCircled(value)}
                  />
                )}
                {icon.additionalProps?.includes('isSolid') && (
                  <StyledBooleanField
                    name="isSolid"
                    label="Solid"
                    value={isSolid}
                    onChange={value => setIsSolid(value)}
                  />
                )}
                <Code className="language-jsx">{codeSample}</Code>
              </StyledOverlay>
            </PositionWrapper>
          </FocusScope>
        )}
      </AnimatePresence>
    </div>
  );
};

export default IconInfo;

const BoxWrap = styled(Button)<{selected: boolean}>`
  width: 100%;
  padding: ${space(1)} ${space(2)};
  border: solid 1px transparent;
  font-weight: 400;

  &:hover {
    border-color: ${p => p.theme.innerBorder};
  }
  &[aria-expanded='true'] {
    border-color: ${p => p.theme.border};
  }

  ${ButtonLabel} {
    display: grid;
    gap: ${space(1)};
    grid-auto-flow: column;
    justify-content: start;
  }
`;

const StyledOverlay = styled(Overlay)`
  width: 20rem;
  padding: ${space(1)} ${space(2)};
`;

const Name = styled('p')`
  position: relative;
  line-height: 1;
  margin-bottom: 0;
  font-size: ${p => p.theme.fontSizeMedium};
  text-transform: capitalize;
`;

const SampleWrap = styled('div')`
  width: 100%;
  height: 4rem;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0 auto ${space(3)};
`;

const SelectorWrap = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;

  &:not(:first-of-type) {
    padding-top: ${space(2)};
  }
  &:not(:last-of-type) {
    padding-bottom: ${space(2)};
    border-bottom: solid 1px ${p => p.theme.innerBorder};
  }
`;

const SelectorLabel = styled('p')`
  margin-bottom: 0;
`;

const StyledSelectField = styled(SelectField)`
  width: 50%;
  padding-left: 10px;
`;

const StyledBooleanField = styled(BooleanField)`
  padding-left: 0;
`;
