import {Dispatch, RefObject, SetStateAction, useEffect, useState} from 'react';
import {Popper} from 'react-popper';
import styled from '@emotion/styled';
import Code from 'docs-ui/components/code';

import SelectField from 'sentry/components/deprecatedforms/selectField';
import BooleanField from 'sentry/components/forms/booleanField';
import space from 'sentry/styles/space';

import {iconProps} from './data';
import IconSample from './sample';
import {ExtendedIconData, SelectedIcon} from './searchPanel';

type Props = {
  boxRef: RefObject<HTMLDivElement>;
  icon: ExtendedIconData;
  setSelectedIcon: Dispatch<SetStateAction<SelectedIcon>>;
};

const IconPopper = ({icon, setSelectedIcon, boxRef}: Props) => {
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
  const getCodeSample = () => {
    return `<Icon${icon.name} color="gray500" size="${size}"${
      isCircled ? ' isCircled' : ' '
    }${isSolid ? ' isSolid' : ' '} />`;
  };
  const [codeSample, setCodeSample] = useState(getCodeSample());
  useEffect(() => {
    setCodeSample(getCodeSample());
  }, [size, isCircled, isSolid]);

  /**
   * Deselect icon box on outside click
   */
  const clickAwayHandler = e => {
    if (e.target !== boxRef && !boxRef?.contains?.(e.target)) {
      setSelectedIcon({group: '', icon: ''});
    }
  };
  useEffect(() => {
    document.addEventListener('click', clickAwayHandler);
    return () => document.removeEventListener('click', clickAwayHandler);
  }, []);

  return (
    <Popper
      placement="bottom"
      modifiers={{
        offset: {offset: '0, 10'},
        flip: {enabled: false},
      }}
    >
      {({ref: popperRef, style, placement}) => {
        return (
          <Wrap
            ref={popperRef}
            style={style}
            data-placement={placement}
            /**
             * Prevent click event from propagating up to <IconInfoBox />,
             * otherwise it would trigger setSelectedIcon and deselect the icon box.
             */
            onClick={e => e.stopPropagation()}
          >
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

            <PropsWrap>
              <SelectorWrap>
                <SelectorLabel>Size</SelectorLabel>
                <StyledSelectField
                  name="size"
                  defaultValue={iconProps.size.default}
                  choices={iconProps.size.options}
                  onChange={value => setSize(value as string)}
                  clearable={false}
                />
              </SelectorWrap>
              {icon.additionalProps?.includes('direction') && (
                <SelectorWrap>
                  <SelectorLabel>Direction</SelectorLabel>
                  <StyledSelectField
                    name="type"
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
            </PropsWrap>

            <Code className="language-jsx">{codeSample}</Code>
          </Wrap>
        );
      }}
    </Popper>
  );
};

export default IconPopper;

const Wrap = styled('div')`
  text-align: left;
  max-width: 20rem;
  padding: ${space(2)};
  padding-bottom: 0;
  background: ${p => p.theme.background};
  border: solid 1px ${p => p.theme.border};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  border-radius: ${p => p.theme.borderRadius};
  z-index: ${p => p.theme.zIndex.modal};
  cursor: initial;
`;

const SampleWrap = styled('div')`
  width: 100%;
  height: 4rem;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0 auto ${space(3)};
`;

const PropsWrap = styled('div')``;

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
