import {useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';
import Code from 'docs-ui/components/code';
import {AnimatePresence} from 'framer-motion';

import Button, {ButtonLabel} from 'sentry/components/button';
import BooleanField from 'sentry/components/forms/booleanField';
import SelectField from 'sentry/components/forms/selectField';
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
                <div>
                  <StyledSelectField
                    name="size"
                    label="Size"
                    value={size}
                    options={iconProps.size.options}
                    onChange={value => setSize(value)}
                    clearable={false}
                    flexibleControlStateSize
                  />
                  {icon.additionalProps?.includes('direction') && (
                    <StyledSelectField
                      name="direction"
                      label="Direction"
                      value={direction}
                      options={iconProps.direction.options}
                      onChange={value => setDirection(value)}
                      clearable={false}
                      flexibleControlStateSize
                    />
                  )}
                  {icon.additionalProps?.includes('type') && (
                    <StyledSelectField
                      name="type"
                      label="Type"
                      value={type}
                      options={iconProps.type.options}
                      onChange={value => setType(value)}
                      clearable={false}
                      flexibleControlStateSize
                    />
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
                </div>
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

const StyledSelectField = styled(SelectField)`
  padding: ${space(1)} 0;
`;

const StyledBooleanField = styled(BooleanField)`
  padding: ${space(1)} 0;
`;
